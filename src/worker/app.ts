import { Hono } from "hono";
import type { Adapters } from "./adapters";
import type { Env } from "./env";

export type AppContext = { Bindings: Env; Variables: { adapters: Adapters } };

/** Builds the API. Adapters are passed in so tests can use recording fakes. */
export function createApp(adapters: Adapters) {
  const app = new Hono<AppContext>().basePath("/api");

  app.use(async (c, next) => {
    c.set("adapters", adapters);
    await next();
  });

  app.get("/health", async (c) => {
    const row = await c.env.DB.prepare("SELECT value FROM app_setting WHERE key = 'app_name'").first<{
      value: string;
    }>();
    return c.json({ ok: true, appName: row?.value ?? null });
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}
