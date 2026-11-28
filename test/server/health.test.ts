import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/worker/app";
import { harness } from "../support/auth";
import { fakeAdapters } from "../support/fakes";

describe("health", () => {
  it("reports the app name stored in the database", async () => {
    const app = createApp(fakeAdapters());

    const res = await app.fetch(new Request("https://app.test/api/health"), env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, appName: "Happy Home Field Service" });
  });
});

describe("deployed entry point", () => {
  it("serves the API from the Worker that Cloudflare runs", async () => {
    const { exports } = await import("cloudflare:workers");

    const res = await exports.default.fetch("https://app.test/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("refuses unknown API routes to anyone not signed in", async () => {
    const { exports } = await import("cloudflare:workers");

    const res = await exports.default.fetch("https://app.test/api/nope");

    expect(res.status).toBe(401);
  });
});

describe("unknown routes", () => {
  it("return a JSON 404 to a signed-in user", async () => {
    const h = harness();
    const cookie = await h.setupOwner();

    const res = await h.call("GET", "/api/nope", undefined, cookie);

    expect(res).toMatchObject({ status: 404, body: { error: "not_found" } });
  });
});
