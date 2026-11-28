import { describe, expect, it } from "vitest";
import { harness } from "../support/auth";

async function office() {
  const h = harness();
  const cookie = await h.setupOwner();
  const create = (body: unknown) => h.call("POST", "/api/contacts", body, cookie);
  const search = async (q: string) => (await h.call("GET", `/api/contacts?q=${encodeURIComponent(q)}`, undefined, cookie)).body;
  return { h, cookie, create, search };
}

const person = {
  kind: "person",
  name: "Carin Brown",
  phones: ["082 123 4567"],
  email: "Carin@Example.co.za",
  addresses: [{ line: "12 Oak Road", suburb: "Bergvliet" }],
};

describe("creating a contact", () => {
  it("saves a person with a normalised SA phone number and lower-case email", async () => {
    const { create } = await office();

    const res = await create(person);

    expect(res.status).toBe(201);
    expect(res.body.contact).toMatchObject({
      kind: "person",
      name: "Carin Brown",
      phones: ["+27821234567"],
      email: "carin@example.co.za",
      addresses: [{ line: "12 Oak Road", suburb: "Bergvliet" }],
      isPartner: false,
    });
    expect(res.body.warnings).toEqual([]);
  });

  it("saves an organisation flagged as a Partner", async () => {
    const { create } = await office();

    const res = await create({ kind: "organisation", name: "Hirsch's", phones: ["021 555 0101"], isPartner: true });

    expect(res.body.contact).toMatchObject({ kind: "organisation", phones: ["+27215550101"], isPartner: true, email: null });
  });

  it.each(["123", "082 123 456", "+44 20 7946 0958", "abc"])("rejects %s as an SA phone number", async (phone) => {
    const { create } = await office();

    const res = await create({ ...person, phones: [phone] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_phone", value: phone });
  });

  it("requires a name and at least one phone number", async () => {
    const { create } = await office();
    expect((await create({ ...person, name: " " })).status).toBe(400);
    expect((await create({ ...person, phones: [] })).status).toBe(400);
  });
});

describe("duplicate warnings", () => {
  it("warns, but still saves, when the phone or email already belongs to someone else", async () => {
    const { create } = await office();
    const first = await create(person);

    const res = await create({ kind: "person", name: "C. Brown", phones: ["+27 82 123 4567"], email: "carin@example.co.za" });

    expect(res.status).toBe(201);
    expect(res.body.warnings).toEqual([
      { field: "phone", value: "+27821234567", contactId: first.body.contact.id, contactName: "Carin Brown" },
      { field: "email", value: "carin@example.co.za", contactId: first.body.contact.id, contactName: "Carin Brown" },
    ]);
  });

  it("does not warn about a contact's own details when editing it", async () => {
    const { h, cookie, create } = await office();
    const first = await create(person);

    const res = await h.call("PATCH", `/api/contacts/${first.body.contact.id}`, { ...person, name: "Carin Brown-Smith" }, cookie);

    expect(res.status).toBe(200);
    expect(res.body.contact.name).toBe("Carin Brown-Smith");
    expect(res.body.warnings).toEqual([]);
  });

  it("returns 404 when editing a contact that doesn't exist", async () => {
    const { h, cookie } = await office();
    expect((await h.call("PATCH", "/api/contacts/missing", person, cookie)).status).toBe(404);
  });
});

describe("finding a contact", () => {
  it.each(["0821234567", "082 123 4567", "+27 82 123 4567", "082 123", "4567"])("finds by phone typed as %s", async (q) => {
    const { create, search } = await office();
    await create(person);
    await create({ kind: "person", name: "Someone Else", phones: ["083 999 0000"] });

    expect((await search(q)).map((c: { name: string }) => c.name)).toEqual(["Carin Brown"]);
  });

  it("finds by part of the name or email, ignoring case", async () => {
    const { create, search } = await office();
    await create(person);

    expect((await search("brown")).map((c: { name: string }) => c.name)).toEqual(["Carin Brown"]);
    expect((await search("CARIN@")).map((c: { name: string }) => c.name)).toEqual(["Carin Brown"]);
  });

  it("returns nothing for a search shorter than 2 characters", async () => {
    const { create, search } = await office();
    await create(person);

    expect(await search("c")).toEqual([]);
  });

  it("opens a contact by id", async () => {
    const { h, cookie, create } = await office();
    const created = await create(person);

    const res = await h.call("GET", `/api/contacts/${created.body.contact.id}`, undefined, cookie);

    expect(res.body).toMatchObject({ name: "Carin Brown", phones: ["+27821234567"] });
    expect((await h.call("GET", "/api/contacts/missing", undefined, cookie)).status).toBe(404);
  });
});

describe("access", () => {
  it("is for Office users only", async () => {
    const { h, cookie } = await office();
    await h.call("POST", "/api/users", { name: "Tech", email: "tech@example.co.za", role: "technician" }, cookie);
    const tech = await h.signIn("tech@example.co.za");

    expect((await h.call("GET", "/api/contacts?q=carin", undefined, tech)).status).toBe(403);
    expect((await h.call("POST", "/api/contacts", person, tech)).status).toBe(403);
  });
});
