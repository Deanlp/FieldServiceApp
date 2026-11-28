import { Hono } from "hono";
import type { AppContext } from "./app";
import { requireRole } from "./auth";

export const PICKLISTS = { applianceType: "appliance_type", brand: "brand", faultCategory: "fault_category" } as const;
export type PicklistKey = keyof typeof PICKLISTS;
type ListName = (typeof PICKLISTS)[PicklistKey];
const ROUTE_TO_LIST: Record<string, ListName> = { "appliance-type": "appliance_type", brand: "brand", "fault-category": "fault_category" };

/** Returns the stored spelling of `value` in `list` (matched ignoring case), or null if it isn't on the list. */
export async function canonicalPicklistValue(db: D1Database, list: ListName, value: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM picklist_item WHERE list = ? AND value = ?").bind(list, value.trim()).first<{ value: string }>();
  return row?.value ?? null;
}

export function picklistRoutes() {
  const r = new Hono<AppContext>();
  r.use(requireRole("office"));

  r.get("/", async (c) => {
    const { results } = await c.env.DB.prepare("SELECT list, value FROM picklist_item ORDER BY list, position, value").all<{
      list: ListName;
      value: string;
    }>();
    const out: Record<PicklistKey, string[]> = { applianceType: [], brand: [], faultCategory: [] };
    for (const [key, list] of Object.entries(PICKLISTS) as [PicklistKey, ListName][]) {
      out[key] = results.filter((r) => r.list === list).map((r) => r.value);
    }
    return c.json(out);
  });

  // Lists are addressed as /appliance-type, /brand, /fault-category (also accepts the camelCase keys).
  r.post("/:list", async (c) => {
    const p = c.req.param("list");
    const list = ROUTE_TO_LIST[p] ?? PICKLISTS[p as PicklistKey];
    if (!list) return c.json({ error: "not_found" }, 404);
    const { value: raw } = await c.req.json<{ value?: string }>().catch(() => ({}) as { value?: string });
    const value = (raw ?? "").trim();
    if (!value) return c.json({ error: "value_required" }, 400);

    const existing = await canonicalPicklistValue(c.env.DB, list, value);
    if (existing) return c.json({ value: existing }, 200);
    await c.env.DB.prepare(
      "INSERT INTO picklist_item (list, value, position) VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM picklist_item WHERE list = ?))",
    )
      .bind(list, value, list)
      .run();
    return c.json({ value }, 201);
  });

  return r;
}
