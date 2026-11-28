import { Hono } from "hono";
import type { AppContext } from "./app";
import { normaliseEmail, requireOwner, toUser, type Role } from "./auth";

/** Owner-only user management. */
export function userRoutes() {
  const r = new Hono<AppContext>();
  r.use(requireOwner);

  r.get("/", async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM app_user ORDER BY created_at, email").all();
    return c.json(results.map((row) => toUser(row as Parameters<typeof toUser>[0])));
  });

  r.post("/", async (c) => {
    const body = await c.req
      .json<{ name?: string; email?: string; role?: string }>()
      .catch(() => ({}) as { name?: string; email?: string; role?: string });
    const name = (body.name ?? "").trim();
    const email = normaliseEmail(body.email);
    const role = body.role as Role;
    if (!name || !email.includes("@") || (role !== "office" && role !== "technician")) {
      return c.json({ error: "name_email_and_role_required" }, 400);
    }
    const taken = await c.env.DB.prepare("SELECT 1 FROM app_user WHERE email = ?").bind(email).first();
    if (taken) return c.json({ error: "email_taken" }, 409);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO app_user (id, name, email, role, is_owner, active, created_at) VALUES (?, ?, ?, ?, 0, 1, ?)",
    )
      .bind(id, name, email, role, c.var.deps.clock.now())
      .run();
    return c.json({ id, name, email, role, isOwner: false, active: true }, 201);
  });

  r.post("/:id/deactivate", async (c) => {
    const id = c.req.param("id");
    if (id === c.var.user.id) return c.json({ error: "cannot_deactivate_self" }, 400);
    const res = await c.env.DB.batch([
      c.env.DB.prepare("UPDATE app_user SET active = 0 WHERE id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM user_session WHERE user_id = ?").bind(id),
    ]);
    if ((res[0]?.meta.changes ?? 0) === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });

  return r;
}
