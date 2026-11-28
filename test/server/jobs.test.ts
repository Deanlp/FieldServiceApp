import { describe, expect, it } from "vitest";
import { harness } from "../support/auth";

async function office() {
  const h = harness();
  const cookie = await h.setupOwner();
  const post = (path: string, body: unknown) => h.call("POST", path, body, cookie);
  const get = (path: string) => h.call("GET", path, undefined, cookie);
  const contact = async (body: Record<string, unknown>) =>
    (await post("/api/contacts", { kind: "person", phones: ["082 123 4567"], ...body })).body.contact as { id: string };
  return { h, cookie, post, get, contact };
}

const quickJob = (customerId: string) => ({
  customerId,
  serviceAddress: { line: "12 Oak Road", suburb: "Bergvliet" },
  leadChannel: "Repeat",
  warranty: false,
  appliance: { type: "Oven" },
  reportedFault: "Lower oven burner cutting out",
});

describe("creating a Job", () => {
  it("creates a New Job from the quickest path, with the Customer as Payer", async () => {
    const { post, contact } = await office();
    const customer = await contact({ name: "Carin Brown" });

    const res = await post("/api/jobs", quickJob(customer.id));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      number: 1001,
      status: "New",
      customer: { id: customer.id, name: "Carin Brown" },
      payer: { id: customer.id, name: "Carin Brown" },
      partner: null,
      serviceAddress: { line: "12 Oak Road", suburb: "Bergvliet" },
      leadChannel: "Repeat",
      warranty: false,
      appliance: { type: "Oven", brand: null, model: null, serialNumber: null, purchaseDate: null },
      reportedFault: "Lower oven burner cutting out",
      faultCategory: null,
      partnerReference: null,
      payerReference: null,
    });
  });

  it("numbers Jobs in sequence", async () => {
    const { post, contact } = await office();
    const customer = await contact({ name: "Carin Brown" });

    const first = await post("/api/jobs", quickJob(customer.id));
    const second = await post("/api/jobs", quickJob(customer.id));

    expect([first.body.number, second.body.number]).toEqual([1001, 1002]);
  });

  it("records a different Payer, a Partner and both references for a warranty job", async () => {
    const { post, contact } = await office();
    const tenant = await contact({ name: "Tenant" });
    const agent = await contact({ kind: "organisation", name: "Pam Golding Rentals", phones: ["021 555 0000"] });
    const smeg = await contact({ kind: "organisation", name: "SMEG SA", phones: ["011 656 0025"], isPartner: true });

    const res = await post("/api/jobs", {
      ...quickJob(tenant.id),
      payerId: agent.id,
      leadChannel: "Partner",
      partnerId: smeg.id,
      partnerReference: "636522",
      payerReference: "WO-88",
      warranty: true,
      appliance: { type: "Oven", brand: "SMEG", model: " sf6341gvx ", serialNumber: "wm3t04xsa", purchaseDate: "2025-03-01" },
      faultCategory: "Thermocouple / flame failure",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      customer: { name: "Tenant" },
      payer: { name: "Pam Golding Rentals" },
      partner: { name: "SMEG SA" },
      partnerReference: "636522",
      payerReference: "WO-88",
      warranty: true,
      appliance: { type: "Oven", brand: "SMEG", model: "SF6341GVX", serialNumber: "WM3T04XSA", purchaseDate: "2025-03-01" },
      faultCategory: "Thermocouple / flame failure",
    });
  });

  it.each([
    ["no Lead Channel", { leadChannel: undefined }, "lead_channel_required"],
    ["an unknown Lead Channel", { leadChannel: "Facebook" }, "lead_channel_required"],
    ["Lead Channel Partner with no Partner", { leadChannel: "Partner" }, "partner_required"],
    ["no appliance type", { appliance: {} }, "appliance_type_required"],
    ["an appliance type not on the list", { appliance: { type: "Toaster oven thing" } }, "unknown_appliance_type"],
    ["a brand not on the list", { appliance: { type: "Oven", brand: "Acme" } }, "unknown_brand"],
    ["a fault category not on the list", { faultCategory: "Gremlins" }, "unknown_fault_category"],
    ["no reported fault", { reportedFault: " " }, "reported_fault_required"],
    ["no service address", { serviceAddress: { line: "", suburb: "" } }, "service_address_required"],
    ["a bad purchase date", { appliance: { type: "Oven", purchaseDate: "31/02/2025" } }, "invalid_purchase_date"],
    ["an unknown Customer", { customerId: "missing" }, "customer_not_found"],
  ])("refuses a Job with %s", async (_name, overrides, error) => {
    const { post, contact } = await office();
    const customer = await contact({ name: "Carin Brown" });

    const res = await post("/api/jobs", { ...quickJob(customer.id), ...overrides });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
  });

  it("refuses a Partner that isn't flagged as a Partner", async () => {
    const { post, contact } = await office();
    const customer = await contact({ name: "Carin Brown" });
    const notPartner = await contact({ kind: "organisation", name: "Random Co", phones: ["021 555 0001"] });

    const res = await post("/api/jobs", { ...quickJob(customer.id), leadChannel: "Partner", partnerId: notPartner.id });

    expect(res.body.error).toBe("partner_required");
  });

  it("opens a Job by id", async () => {
    const { post, get, contact } = await office();
    const customer = await contact({ name: "Carin Brown" });
    const created = await post("/api/jobs", quickJob(customer.id));

    const res = await get(`/api/jobs/${created.body.id}`);

    expect(res.body).toEqual(created.body);
    expect((await get("/api/jobs/missing")).status).toBe(404);
  });
});

describe("pick-lists", () => {
  it("come with sensible starting values", async () => {
    const { get } = await office();

    const res = await get("/api/picklists");

    expect(res.body.applianceType).toContain("Oven");
    expect(res.body.brand[0]).toBe("SMEG");
    expect(res.body.faultCategory).toContain("Thermocouple / flame failure");
  });

  it("can be added to, without case-insensitive duplicates", async () => {
    const { post, get, contact } = await office();

    expect((await post("/api/picklists/brand", { value: "Falcon" })).status).toBe(201);
    expect((await post("/api/picklists/brand", { value: "falcon" })).status).toBe(200);
    expect((await get("/api/picklists")).body.brand.filter((b: string) => b.toLowerCase() === "falcon")).toEqual(["Falcon"]);

    const customer = await contact({ name: "Carin Brown" });
    const res = await post("/api/jobs", { ...quickJob(customer.id), appliance: { type: "Oven", brand: "falcon" } });
    expect(res.body.appliance.brand).toBe("Falcon");
  });

  it("rejects unknown lists", async () => {
    const { post } = await office();
    expect((await post("/api/picklists/colour", { value: "Red" })).status).toBe(404);
  });
});

describe("a Contact's Jobs", () => {
  it("lists every Job the Contact is on, and in which role", async () => {
    const { post, get, contact } = await office();
    const tenant = await contact({ name: "Tenant" });
    const agent = await contact({ kind: "organisation", name: "Agent", phones: ["021 555 0000"] });
    const job = await post("/api/jobs", { ...quickJob(tenant.id), payerId: agent.id });

    const res = await get(`/api/contacts/${agent.id}/jobs`);

    expect(res.body).toEqual([
      { id: job.body.id, number: 1001, status: "New", createdAt: job.body.createdAt, applianceType: "Oven", reportedFault: "Lower oven burner cutting out", roles: ["Payer"] },
    ]);
    expect((await get(`/api/contacts/${tenant.id}/jobs`)).body[0].roles).toEqual(["Customer"]);
  });
});

describe("access", () => {
  it("Technicians cannot create Jobs or read pick-list admin", async () => {
    const { h, cookie, contact } = await office();
    const customer = await contact({ name: "Carin Brown" });
    await h.call("POST", "/api/users", { name: "Tech", email: "tech@example.co.za", role: "technician" }, cookie);
    const tech = await h.signIn("tech@example.co.za");

    expect((await h.call("POST", "/api/jobs", quickJob(customer.id), tech)).status).toBe(403);
    expect((await h.call("POST", "/api/picklists/brand", { value: "X" }, tech)).status).toBe(403);
  });
});

describe("listing Partners", () => {
  it("lists only Contacts flagged as Partners", async () => {
    const { get, contact } = await office();
    await contact({ kind: "organisation", name: "SMEG SA", phones: ["011 656 0025"], isPartner: true });
    await contact({ kind: "organisation", name: "Random Co", phones: ["021 555 0001"] });

    const res = await get("/api/contacts?partners=true");

    expect(res.body.map((c: { name: string }) => c.name)).toEqual(["SMEG SA"]);
  });
});
