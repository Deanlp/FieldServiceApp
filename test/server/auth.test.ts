import { describe, expect, it } from "vitest";
import { harness, SETUP_TOKEN } from "../support/auth";

describe("first-run setup", () => {
  it("creates the owner once, with the setup token", async () => {
    const h = harness();
    const noToken = await h.call("POST", "/api/setup", { name: "Owner", email: "owner@example.co.za" });
    expect(noToken.status).toBe(403);

    const ok = await h.call("POST", "/api/setup", { name: "Owner", email: "owner@example.co.za" }, undefined, {
      "x-setup-token": SETUP_TOKEN,
    });
    expect(ok.status).toBe(201);

    const again = await h.call("POST", "/api/setup", { name: "Other", email: "other@example.co.za" }, undefined, {
      "x-setup-token": SETUP_TOKEN,
    });
    expect(again.status).toBe(409);
  });
});

describe("signing in with an emailed code", () => {
  it("emails a 6-digit code and signs the user in with it", async () => {
    const h = harness();
    const cookie = await h.setupOwner("Owner@Example.co.za");

    const me = await h.call("GET", "/api/me", undefined, cookie);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ name: "Owner", email: "owner@example.co.za", role: "office", isOwner: true });
  });

  it("gives the same answer for unknown emails and sends nothing", async () => {
    const h = harness();
    await h.setupOwner();
    const sentBefore = h.deps.calls.sentEmails.length;

    const res = await h.call("POST", "/api/auth/request-code", { email: "stranger@example.com" });

    expect(res).toMatchObject({ status: 200, body: { ok: true } });
    expect(h.deps.calls.sentEmails.length).toBe(sentBefore);
  });

  it("rejects a wrong code", async () => {
    const h = harness();
    await h.call("POST", "/api/setup", { name: "Owner", email: "owner@example.co.za" }, undefined, { "x-setup-token": SETUP_TOKEN });
    await h.call("POST", "/api/auth/request-code", { email: "owner@example.co.za" });
    const right = h.lastCodeSentTo("owner@example.co.za");
    const wrong = right === "000000" ? "111111" : "000000";

    const res = await h.call("POST", "/api/auth/verify", { email: "owner@example.co.za", code: wrong });

    expect(res.status).toBe(401);
    expect(res.setCookie).toBeNull();
  });

  it("rejects a code that has already been used", async () => {
    const h = harness();
    await h.setupOwner("owner@example.co.za");
    const used = h.lastCodeSentTo("owner@example.co.za");

    const res = await h.call("POST", "/api/auth/verify", { email: "owner@example.co.za", code: used });

    expect(res.status).toBe(401);
  });

  it("rejects a code after 10 minutes", async () => {
    const h = harness();
    await h.call("POST", "/api/setup", { name: "Owner", email: "owner@example.co.za" }, undefined, { "x-setup-token": SETUP_TOKEN });
    await h.call("POST", "/api/auth/request-code", { email: "owner@example.co.za" });
    h.deps.clock.advanceMinutes(11);

    const res = await h.call("POST", "/api/auth/verify", { email: "owner@example.co.za", code: h.lastCodeSentTo("owner@example.co.za") });

    expect(res.status).toBe(401);
  });

  it("stops sending codes after 5 requests in an hour", async () => {
    const h = harness();
    await h.call("POST", "/api/setup", { name: "Owner", email: "owner@example.co.za" }, undefined, { "x-setup-token": SETUP_TOKEN });
    for (let i = 0; i < 7; i++) await h.call("POST", "/api/auth/request-code", { email: "owner@example.co.za" });

    expect(h.deps.calls.sentEmails.filter((m) => m.to.includes("owner@example.co.za")).length).toBe(5);
  });

  it("locks a code after 5 wrong attempts", async () => {
    const h = harness();
    await h.call("POST", "/api/setup", { name: "Owner", email: "owner@example.co.za" }, undefined, { "x-setup-token": SETUP_TOKEN });
    await h.call("POST", "/api/auth/request-code", { email: "owner@example.co.za" });
    const right = h.lastCodeSentTo("owner@example.co.za");
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await h.call("POST", "/api/auth/verify", { email: "owner@example.co.za", code: wrong });

    const res = await h.call("POST", "/api/auth/verify", { email: "owner@example.co.za", code: right });

    expect(res.status).toBe(401);
  });

  it("signs out", async () => {
    const h = harness();
    const cookie = await h.setupOwner();

    await h.call("POST", "/api/auth/sign-out", undefined, cookie);

    expect((await h.call("GET", "/api/me", undefined, cookie)).status).toBe(401);
  });
});

describe("sessions", () => {
  it("rejects requests without a session", async () => {
    const h = harness();
    expect((await h.call("GET", "/api/me")).status).toBe(401);
    expect((await h.call("GET", "/api/users")).status).toBe(401);
  });

  it("keeps Technicians signed in for 90 days and Office users for 14", async () => {
    const h = harness();
    const owner = await h.setupOwner();
    await h.call("POST", "/api/users", { name: "Tech", email: "tech@example.co.za", role: "technician" }, owner);
    const tech = await h.signIn("tech@example.co.za");

    h.deps.clock.advanceDays(15);
    expect((await h.call("GET", "/api/me", undefined, owner)).status).toBe(401);
    expect((await h.call("GET", "/api/me", undefined, tech)).status).toBe(200);

    h.deps.clock.advanceDays(76);
    expect((await h.call("GET", "/api/me", undefined, tech)).status).toBe(401);
  });
});

describe("managing users", () => {
  it("lets the owner add users who can then sign in", async () => {
    const h = harness();
    const owner = await h.setupOwner();

    const added = await h.call("POST", "/api/users", { name: "Sipho", email: "sipho@example.co.za", role: "technician" }, owner);
    expect(added.status).toBe(201);

    const tech = await h.signIn("sipho@example.co.za");
    const me = await h.call("GET", "/api/me", undefined, tech);
    expect(me.body).toMatchObject({ name: "Sipho", role: "technician", isOwner: false });

    const list = await h.call("GET", "/api/users", undefined, owner);
    expect(list.body.map((u: { email: string }) => u.email)).toEqual(["owner@example.co.za", "sipho@example.co.za"]);
  });

  it("refuses a duplicate email", async () => {
    const h = harness();
    const owner = await h.setupOwner();
    await h.call("POST", "/api/users", { name: "A", email: "a@example.co.za", role: "office" }, owner);

    const dup = await h.call("POST", "/api/users", { name: "A again", email: "A@example.co.za", role: "office" }, owner);

    expect(dup.status).toBe(409);
  });

  it("deactivating a user ends their sessions immediately and stops new codes", async () => {
    const h = harness();
    const owner = await h.setupOwner();
    const added = await h.call("POST", "/api/users", { name: "Tech", email: "tech@example.co.za", role: "technician" }, owner);
    const tech = await h.signIn("tech@example.co.za");

    await h.call("POST", `/api/users/${added.body.id}/deactivate`, undefined, owner);

    expect((await h.call("GET", "/api/me", undefined, tech)).status).toBe(401);
    const before = h.deps.calls.sentEmails.length;
    await h.call("POST", "/api/auth/request-code", { email: "tech@example.co.za" });
    expect(h.deps.calls.sentEmails.length).toBe(before);
  });

  it("only the owner can manage users", async () => {
    const h = harness();
    const owner = await h.setupOwner();
    await h.call("POST", "/api/users", { name: "Tech", email: "tech@example.co.za", role: "technician" }, owner);
    await h.call("POST", "/api/users", { name: "Admin", email: "admin@example.co.za", role: "office" }, owner);
    const tech = await h.signIn("tech@example.co.za");
    const admin = await h.signIn("admin@example.co.za");

    expect((await h.call("GET", "/api/users", undefined, tech)).status).toBe(403);
    expect((await h.call("POST", "/api/users", { name: "X", email: "x@example.co.za", role: "office" }, admin)).status).toBe(403);
  });

  it("the owner cannot deactivate themselves", async () => {
    const h = harness();
    const owner = await h.setupOwner();
    const me = await h.call("GET", "/api/me", undefined, owner);

    const res = await h.call("POST", `/api/users/${me.body.id}/deactivate`, undefined, owner);

    expect(res.status).toBe(400);
  });
});
