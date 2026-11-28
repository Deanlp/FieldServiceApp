import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/worker/app";
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

  it("returns a JSON 404 for unknown API routes", async () => {
    const { exports } = await import("cloudflare:workers");

    const res = await exports.default.fetch("https://app.test/api/nope");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
