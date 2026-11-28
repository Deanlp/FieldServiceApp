import { env } from "cloudflare:workers";
import { createApp } from "../../src/worker/app";
import { fakeAdapters } from "./fakes";

export const SETUP_TOKEN = "test-setup-token";

/** A test harness around the real API with recording fakes and a controllable clock. */
export function harness() {
  const deps = fakeAdapters();
  const app = createApp(deps);

  async function call(method: string, path: string, body?: unknown, cookie?: string, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extraHeaders };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const res = await app.fetch(
      new Request(`https://app.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
      { ...env, SETUP_TOKEN },
    );
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.get("set-cookie") };
  }

  function lastCodeSentTo(email: string): string {
    const mail = [...deps.calls.sentEmails].reverse().find((m) => m.to.includes(email.toLowerCase()));
    const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`No sign-in code was emailed to ${email}`);
    return code;
  }

  async function signIn(email: string): Promise<string> {
    await call("POST", "/api/auth/request-code", { email });
    const res = await call("POST", "/api/auth/verify", { email, code: lastCodeSentTo(email) });
    if (res.status !== 200 || !res.setCookie) throw new Error(`Sign-in failed for ${email}: ${res.status}`);
    return res.setCookie.split(";")[0]!;
  }

  /** Creates the owner through first-run setup and returns their session cookie. */
  async function setupOwner(email = "owner@example.co.za") {
    await call("POST", "/api/setup", { name: "Owner", email }, undefined, { "x-setup-token": SETUP_TOKEN });
    return signIn(email);
  }

  return { deps, call, signIn, setupOwner, lastCodeSentTo };
}
