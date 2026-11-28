import { describe, expect, it } from "vitest";
import { buildWarrantyClaim, type ClaimJob } from "../../src/domain/warranty-claim";

const settings = { rate: 425, bandAmount: 450, kmRate: 5.5, hourlyTravelRate: 150 };
const period = { start: "2026-10-06", end: "2026-11-05" };
const asOf = "2026-11-08";

function job(overrides: Partial<ClaimJob> = {}): ClaimJob {
  return {
    jobId: "job-1",
    isWarranty: true,
    customerName: "A Customer",
    ticketNumbers: ["636522"],
    repairDescription: "Thermocouple fitted",
    town: "Bergvliet",
    visits: [{ date: "2026-10-09", roundTripKm: 30 }],
    partsFitted: [{ partNumber: "818650277", description: "Thermocouple" }],
    extras: { amount: 20, note: "" },
    serialNumber: "SN123",
    purchaseDate: "2025-03-01",
    sscClosedConfirmed: true,
    sparesReturned: true,
    exchange: false,
    unitReturned: false,
    alreadyClaimed: false,
    carriedForward: false,
    ...overrides,
  };
}

describe("a typical Cape Town warranty job", () => {
  it("claims the rate plus extras with no travel", () => {
    const claim = buildWarrantyClaim({ jobs: [job()], settings, period, asOf });

    expect(claim.rows).toEqual([
      {
        jobId: "job-1",
        date: "2026-10-09",
        client: "A Customer",
        ticket: "636522",
        description: "Thermocouple fitted",
        town: "Bergvliet",
        rate: 425,
        totalKm: 30,
        band: 0,
        travelAmount: 0,
        travelTime: 0,
        extras: 20,
        total: 445,
        notes: "1 visit: 09/10. Parts: 818650277 Thermocouple.",
      },
    ]);
    expect(claim.total).toBe(445);
    expect(claim.exceptions).toEqual([]);
  });
});

describe("travel", () => {
  const row = (visits: ClaimJob["visits"], extras = 0) =>
    buildWarrantyClaim({ jobs: [job({ visits, extras: { amount: extras, note: "" } })], settings, period, asOf }).rows[0]!;

  it.each([
    // [trips, totalKm, band, travelAmount, travelTime, extras, total]
    ["one short trip", [30], 30, 0, 0, 0, 0, 425],
    ["several short visits", [25, 25, 25], 75, 0, 0, 0, 0, 425],
    ["one trip just over 120 km", [130], 130, 450, 0, 0, 0, 875],
    ["one 340 km trip", [340], 340, 450, 770, 150, 0, 1795],
    ["one 660 km trip (SMEG's sample)", [660], 660, 450, 2530, 675, 0, 4080],
    ["two trips over 120 km", [130, 140], 270, 450, 0, 0, 450, 1325],
  ] as const)("%s", (_name, trips, totalKm, band, travelAmount, travelTime, extras, total) => {
    const r = row(trips.map((km, i) => ({ date: `2026-10-1${i}`, roundTripKm: km })));
    expect({ totalKm: r.totalKm, band: r.band, travelAmount: r.travelAmount, travelTime: r.travelTime, extras: r.extras, total: r.total })
      .toEqual({ totalKm, band, travelAmount, travelTime, extras, total });
  });

  it("explains a second trip's band in the notes", () => {
    const r = row([{ date: "2026-10-10", roundTripKm: 130 }, { date: "2026-10-17", roundTripKm: 140 }]);
    expect(r.notes).toBe("2 visits: 10/10, 17/10. Parts: 818650277 Thermocouple. Extra trip band R450 in extras.");
  });
});

describe("which jobs go on the claim", () => {
  const claimFor = (jobs: ClaimJob[]) => buildWarrantyClaim({ jobs, settings, period, asOf });

  it.each([
    ["first day of the period", "2026-10-06", true],
    ["last day of the period", "2026-11-05", true],
    ["day before the period", "2026-10-05", false],
    ["day after the period", "2026-11-06", false],
  ])("a job whose last visit is on the %s: included = %s", (_name, date, included) => {
    const claim = claimFor([job({ visits: [{ date, roundTripKm: 20 }] })]);
    expect(claim.rows.length).toBe(included ? 1 : 0);
  });

  it("uses the last visit as the intervention date", () => {
    const claim = claimFor([job({ visits: [{ date: "2026-09-28", roundTripKm: 20 }, { date: "2026-10-12", roundTripKm: 20 }] })]);
    expect(claim.rows[0]!.date).toBe("2026-10-12");
  });

  it("never claims a job twice, unless it was carried forward unpaid", () => {
    const claim = claimFor([
      job({ jobId: "claimed", alreadyClaimed: true }),
      job({ jobId: "carried", alreadyClaimed: true, carriedForward: true, visits: [{ date: "2026-09-20", roundTripKm: 20 }] }),
    ]);
    expect(claim.rows.map((r) => r.jobId)).toEqual(["carried"]);
  });

  it("lists rows in ticket-number order and totals them", () => {
    const claim = claimFor([
      job({ jobId: "b", ticketNumbers: ["637485"] }),
      job({ jobId: "a", ticketNumbers: ["632861", "637181"] }),
      job({ jobId: "c", ticketNumbers: ["636020"] }),
    ]);
    expect(claim.rows.map((r) => r.ticket)).toEqual(["632861 / 637181", "636020", "637485"]);
    expect(claim.total).toBe(1335);
  });
});

describe("check before adding", () => {
  it.each([
    ["Not a Warranty Job", { isWarranty: false }],
    ["SSC not closed confirmed", { sscClosedConfirmed: false }],
    ["Spares not returned", { sparesReturned: false }],
    ["Exchange unit not returned", { exchange: true, unitReturned: false }],
    ["Missing serial number or purchase date", { serialNumber: null }],
    ["Missing serial number or purchase date", { purchaseDate: null }],
    ["Missing km", { visits: [{ date: "2026-10-09", roundTripKm: null }] }],
    ["Over 60 days since intervention", { carriedForward: true, alreadyClaimed: true, visits: [{ date: "2026-09-01", roundTripKm: 20 }] }],
  ] as const)("%s keeps the job off the claim", (reason, overrides) => {
    const claim = buildWarrantyClaim({ jobs: [job(overrides as Partial<ClaimJob>)], settings, period, asOf });
    expect(claim.rows).toEqual([]);
    expect(claim.exceptions).toEqual([{ jobId: "job-1", ticket: "636522", client: "A Customer", reasons: [reason] }]);
  });

  it("an exchange job with its unit returned is claimable", () => {
    const claim = buildWarrantyClaim({ jobs: [job({ exchange: true, unitReturned: true })], settings, period, asOf });
    expect(claim.rows.length).toBe(1);
  });
});
