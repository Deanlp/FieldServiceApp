import { Hono } from "hono";
import type { Adapters } from "./adapters";
import { authRoutes, requireUser, type User } from "./auth";
import type { Env } from "./env";
import { userRoutes } from "./users";

export interface Clock {
  now(): number;
}

/** Everything the API depends on from outside: adapters for other systems, and the clock. */
export type Deps = Adapters & { clock: Clock };

export type AppContext = { Bindings: Env; Variables: { deps: Deps; user: User } };

/** Builds the API. Dependencies are passed in so tests can use recording fakes and a fixed clock. */
export function createApp(deps: Deps) {
  const app = new Hono<AppContext>().basePath("/api");

  app.use(async (c, next) => {
    c.set("deps", deps);
    await next();
  });

  app.get("/health", async (c) => {
    const row = await c.env.DB.prepare("SELECT value FROM app_setting WHERE key = 'app_name'").first<{
      value: string;
    }>();
    return c.json({ ok: true, appName: row?.value ?? null });
  });

  app.route("/", authRoutes());

  // Everything below needs a signed-in, active user.
  app.use("*", requireUser);
  app.get("/me", (c) => c.json(c.var.user));
  app.route("/users", userRoutes());

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}
