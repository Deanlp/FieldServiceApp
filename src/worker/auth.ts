import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppContext } from "./app";
import { constantTimeEqual, randomToken, sha256Hex, sixDigitCode } from "./crypto";

export type Role = "office" | "technician";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isOwner: boolean;
  active: boolean;
}

const MINUTE = 60_000;
const DAY = 86_400_000;
const CODE_LIFETIME = 10 * MINUTE;
const MAX_CODES_PER_HOUR = 5;
const MAX_FAILED_ATTEMPTS = 5;
const SESSION_LIFETIME: Record<Role, number> = { technician: 90 * DAY, office: 14 * DAY };
const COOKIE = "hh_session";

type UserRow = { id: string; name: string; email: string; role: Role; is_owner: number; active: number };

export const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  isOwner: r.is_owner === 1,
  active: r.active === 1,
});

export const normaliseEmail = (email: unknown) => (typeof email === "string" ? email.trim().toLowerCase() : "");

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM app_user WHERE email = ?").bind(email).first<UserRow>();
}

/** Routes that work without a session: setup, request a code, verify it, sign out. */
export function authRoutes() {
  const r = new Hono<AppContext>();

  r.post("/setup", async (c) => {
    const token = c.req.header("x-setup-token");
    if (!c.env.SETUP_TOKEN || !token || !constantTimeEqual(token, c.env.SETUP_TOKEN)) {
      return c.json({ error: "forbidden" }, 403);
    }
    const existing = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM app_user").first<{ n: number }>();
    if ((existing?.n ?? 0) > 0) return c.json({ error: "already_set_up" }, 409);

    const body = await c.req.json<{ name?: string; email?: string }>().catch(() => ({}) as { name?: string; email?: string });
    const email = normaliseEmail(body.email);
    const name = (body.name ?? "").trim();
    if (!email.includes("@") || !name) return c.json({ error: "name_and_email_required" }, 400);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO app_user (id, name, email, role, is_owner, active, created_at) VALUES (?, ?, ?, 'office', 1, 1, ?)",
    )
      .bind(id, name, email, c.var.deps.clock.now())
      .run();
    return c.json({ id }, 201);
  });

  r.post("/auth/request-code", async (c) => {
    const { email: raw } = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
    const email = normaliseEmail(raw);
    const user = email ? await findUserByEmail(c.env.DB, email) : null;
    const now = c.var.deps.clock.now();

    if (user && user.active === 1) {
      const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM sign_in_code WHERE user_id = ? AND created_at > ?")
        .bind(user.id, now - 60 * MINUTE)
        .first<{ n: number }>();
      if ((recent?.n ?? 0) < MAX_CODES_PER_HOUR) {
        const code = sixDigitCode();
        await c.env.DB.prepare(
          "INSERT INTO sign_in_code (id, user_id, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(crypto.randomUUID(), user.id, await sha256Hex(`${user.id}:${code}`), now, now + CODE_LIFETIME)
          .run();
        await c.var.deps.mailer.send({
          to: [user.email],
          subject: `Your Happy Home sign-in code: ${code}`,
          text: `Your sign-in code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`,
        });
      }
    }
    // Same answer whether or not the email belongs to anyone.
    return c.json({ ok: true });
  });

  r.post("/auth/verify", async (c) => {
    const body = await c.req.json<{ email?: string; code?: string }>().catch(() => ({}) as { email?: string; code?: string });
    const email = normaliseEmail(body.email);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const user = email ? await findUserByEmail(c.env.DB, email) : null;
    const now = c.var.deps.clock.now();
    const invalid = () => c.json({ error: "invalid_code" }, 401);
    if (!user || user.active !== 1 || !/^\d{6}$/.test(code)) return invalid();

    const latest = await c.env.DB.prepare(
      "SELECT id, code_hash, expires_at, used_at, failed_attempts FROM sign_in_code WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(user.id)
      .first<{ id: string; code_hash: string; expires_at: number; used_at: number | null; failed_attempts: number }>();
    if (!latest || latest.used_at !== null || latest.expires_at < now || latest.failed_attempts >= MAX_FAILED_ATTEMPTS) {
      return invalid();
    }
    if (!constantTimeEqual(await sha256Hex(`${user.id}:${code}`), latest.code_hash)) {
      await c.env.DB.prepare("UPDATE sign_in_code SET failed_attempts = failed_attempts + 1 WHERE id = ?").bind(latest.id).run();
      return invalid();
    }

    const token = randomToken();
    const lifetime = SESSION_LIFETIME[user.role];
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE sign_in_code SET used_at = ? WHERE id = ?").bind(now, latest.id),
      c.env.DB.prepare("INSERT INTO user_session (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(
        await sha256Hex(token),
        user.id,
        now,
        now + lifetime,
      ),
    ]);
    setCookie(c, COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.floor(lifetime / 1000),
    });
    return c.json(toUser(user));
  });

  r.post("/auth/sign-out", async (c) => {
    const token = getCookie(c, COOKIE);
    if (token) await c.env.DB.prepare("DELETE FROM user_session WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  return r;
}

/** Rejects requests without a live session for an active user; sets `c.var.user`. */
export const requireUser = createMiddleware<AppContext>(async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ error: "unauthenticated" }, 401);
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM user_session s JOIN app_user u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
  )
    .bind(await sha256Hex(token), c.var.deps.clock.now())
    .first<UserRow>();
  if (!row) return c.json({ error: "unauthenticated" }, 401);
  c.set("user", toUser(row));
  await next();
});

export const requireOwner = createMiddleware<AppContext>(async (c, next) => {
  if (!c.var.user.isOwner) return c.json({ error: "forbidden" }, 403);
  await next();
});
