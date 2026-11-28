/**
 * Warranty Claim builder: turns Warranty Jobs into the rows of SMEG's monthly
 * cover sheet, plus the "Check before adding" list. Pure: no database, no I/O.
 * Rules: docs/reference/smeg-warranty-claim.md
 */

export interface ClaimSettings {
  rate: number;
  bandAmount: number;
  kmRate: number;
  hourlyTravelRate: number;
}

/** Inclusive ISO dates, e.g. 6 October to 5 November. */
export interface ClaimPeriod {
  start: string;
  end: string;
}

export interface ClaimVisit {
  date: string;
  roundTripKm: number | null;
}

export interface ClaimJob {
  jobId: string;
  isWarranty: boolean;
  customerName: string;
  /** Partner References (SMEG ticket numbers). */
  ticketNumbers: string[];
  repairDescription: string;
  town: string;
  visits: ClaimVisit[];
  partsFitted: { partNumber: string; description: string }[];
  extras: { amount: number; note: string };
  serialNumber: string | null;
  purchaseDate: string | null;
  sscClosedConfirmed: boolean;
  sparesReturned: boolean;
  exchange: boolean;
  unitReturned: boolean;
  alreadyClaimed: boolean;
  carriedForward: boolean;
}

export interface ClaimRow {
  jobId: string;
  date: string;
  client: string;
  ticket: string;
  description: string;
  town: string;
  rate: number;
  totalKm: number;
  band: number;
  travelAmount: number;
  travelTime: number;
  extras: number;
  total: number;
  notes: string;
}

export interface ClaimException {
  jobId: string;
  ticket: string;
  client: string;
  reasons: string[];
}

export interface WarrantyClaim {
  rows: ClaimRow[];
  exceptions: ClaimException[];
  total: number;
}

export interface BuildClaimInput {
  jobs: ClaimJob[];
  settings: ClaimSettings;
  period: ClaimPeriod;
  /** The date the claim is being prepared, used for the 60-day deadline. */
  asOf: string;
}

const SINGLE_BAND_FROM_KM = 120;
const FREE_KM_PER_TRIP = 200;
const CLAIM_DEADLINE_DAYS = 60;

export function buildWarrantyClaim({ jobs, settings, period, asOf }: BuildClaimInput): WarrantyClaim {
  const rows: ClaimRow[] = [];
  const exceptions: ClaimException[] = [];

  for (const job of jobs) {
    if (job.alreadyClaimed && !job.carriedForward) continue;
    const intervention = lastVisitDate(job);
    const inPeriod = intervention !== null && intervention >= period.start && intervention <= period.end;
    if (!inPeriod && !job.carriedForward) continue;

    const reasons = readinessProblems(job, intervention, asOf);
    if (reasons.length > 0) {
      exceptions.push({ jobId: job.jobId, ticket: ticketLabel(job), client: job.customerName, reasons });
      continue;
    }
    rows.push(rowFor(job, intervention!, settings));
  }

  rows.sort((a, b) => ticketSortKey(a.ticket) - ticketSortKey(b.ticket));
  return { rows, exceptions, total: money(rows.reduce((sum, r) => sum + r.total, 0)) };
}

function rowFor(job: ClaimJob, intervention: string, s: ClaimSettings): ClaimRow {
  const trips = job.visits.map((v) => v.roundTripKm ?? 0);
  const totalKm = trips.reduce((a, b) => a + b, 0);
  const longTrips = trips.filter((km) => km > SINGLE_BAND_FROM_KM).length;
  const band = longTrips > 0 ? s.bandAmount : 0;
  const extraBands = Math.max(0, longTrips - 1) * s.bandAmount;
  const excessKm = trips.reduce((sum, km) => sum + Math.max(0, km - FREE_KM_PER_TRIP), 0);
  const travelAmount = money(excessKm * s.kmRate);
  const travelTime = money(travelHours(excessKm) * s.hourlyTravelRate);
  const extras = money(job.extras.amount + extraBands);
  const total = money(s.rate + band + travelAmount + travelTime + extras);

  return {
    jobId: job.jobId,
    date: intervention,
    client: job.customerName,
    ticket: ticketLabel(job),
    description: job.repairDescription,
    town: job.town,
    rate: s.rate,
    totalKm,
    band,
    travelAmount,
    travelTime,
    extras,
    total,
    notes: notesFor(job, extraBands),
  };
}

/** Whole hours per 100 km of excess, plus half an hour for a remainder of 50 km or more. */
function travelHours(excessKm: number): number {
  const whole = Math.floor(excessKm / 100);
  return whole + (excessKm % 100 >= 50 ? 0.5 : 0);
}

function readinessProblems(job: ClaimJob, intervention: string | null, asOf: string): string[] {
  const reasons: string[] = [];
  if (!job.isWarranty) reasons.push("Not a Warranty Job");
  if (!job.sscClosedConfirmed) reasons.push("SSC not closed confirmed");
  if (!job.sparesReturned) reasons.push("Spares not returned");
  if (job.exchange && !job.unitReturned) reasons.push("Exchange unit not returned");
  if (!job.serialNumber || !job.purchaseDate) reasons.push("Missing serial number or purchase date");
  if (job.visits.length === 0 || job.visits.some((v) => v.roundTripKm === null)) reasons.push("Missing km");
  if (intervention !== null && daysBetween(intervention, asOf) > CLAIM_DEADLINE_DAYS) {
    reasons.push("Over 60 days since intervention");
  }
  return reasons;
}

function notesFor(job: ClaimJob, extraBands: number): string {
  const n = job.visits.length;
  const dates = job.visits.map((v) => shortDate(v.date)).join(", ");
  const parts = [`${n} ${n === 1 ? "visit" : "visits"}: ${dates}.`];
  if (job.partsFitted.length > 0) {
    parts.push(`Parts: ${job.partsFitted.map((p) => `${p.partNumber} ${p.description}`).join("; ")}.`);
  }
  if (extraBands > 0) parts.push(`Extra trip band R${extraBands} in extras.`);
  if (job.extras.note.trim()) parts.push(`Extras: ${job.extras.note.trim()}.`);
  return parts.join(" ");
}

function lastVisitDate(job: ClaimJob): string | null {
  return job.visits.reduce<string | null>((latest, v) => (latest === null || v.date > latest ? v.date : latest), null);
}

function ticketLabel(job: ClaimJob): string {
  return job.ticketNumbers.join(" / ");
}

function ticketSortKey(ticket: string): number {
  const n = Number.parseInt(ticket, 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The Claim Period whose window contains `date`: the 6th of one month to the 5th of the next. */
export function claimPeriodContaining(dateIso: string): ClaimPeriod {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  const startMonth = d >= 6 ? m : m - 1;
  const start = new Date(Date.UTC(y, startMonth - 1, 6));
  const end = new Date(Date.UTC(y, startMonth, 5));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
