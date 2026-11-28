import { Hono } from "hono";
import type { AppContext } from "./app";
import { requireRole } from "./auth";
import { canonicalPicklistValue } from "./picklists";

export const LEAD_CHANNELS = ["Partner", "Website", "Google", "Repeat", "Word of mouth", "Other"] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

interface ContactSummary {
  id: string;
  name: string;
}

export interface Job {
  id: string;
  number: number;
  status: string;
  customer: ContactSummary;
  payer: ContactSummary;
  partner: ContactSummary | null;
  serviceAddress: { line: string; suburb: string };
  leadChannel: LeadChannel;
  partnerReference: string | null;
  payerReference: string | null;
  warranty: boolean;
  appliance: { type: string; brand: string | null; model: string | null; serialNumber: string | null; purchaseDate: string | null };
  reportedFault: string;
  faultCategory: string | null;
  createdAt: number;
}

class Invalid extends Error {}
const fail = (code: string): never => {
  throw new Invalid(code);
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const upper = (v: unknown) => text(v)?.toUpperCase() ?? null;

function isoDate(v: unknown): string | null {
  const s = text(v);
  if (s === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fail("invalid_purchase_date");
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : fail("invalid_purchase_date");
}

const JOB_SELECT = `
  SELECT j.*, cu.name AS customer_name, pa.name AS payer_name, pt.name AS partner_name
  FROM job j
  JOIN contact cu ON cu.id = j.customer_id
  JOIN contact pa ON pa.id = j.payer_id
  LEFT JOIN contact pt ON pt.id = j.partner_id`;

type JobRow = Record<string, unknown> & {
  id: string; number: number; status: string; customer_id: string; customer_name: string; payer_id: string; payer_name: string;
  partner_id: string | null; partner_name: string | null; service_line: string; service_suburb: string; lead_channel: LeadChannel;
  partner_reference: string | null; payer_reference: string | null; warranty: number; appliance_type: string; brand: string | null;
  model: string | null; serial_number: string | null; purchase_date: string | null; reported_fault: string; fault_category: string | null;
  created_at: number;
};

const toJob = (r: JobRow): Job => ({
  id: r.id,
  number: r.number,
  status: r.status,
  customer: { id: r.customer_id, name: r.customer_name },
  payer: { id: r.payer_id, name: r.payer_name },
  partner: r.partner_id ? { id: r.partner_id, name: r.partner_name ?? "" } : null,
  serviceAddress: { line: r.service_line, suburb: r.service_suburb },
  leadChannel: r.lead_channel,
  partnerReference: r.partner_reference,
  payerReference: r.payer_reference,
  warranty: r.warranty === 1,
  appliance: { type: r.appliance_type, brand: r.brand, model: r.model, serialNumber: r.serial_number, purchaseDate: r.purchase_date },
  reportedFault: r.reported_fault,
  faultCategory: r.fault_category,
  createdAt: r.created_at,
});

export async function loadJob(db: D1Database, id: string): Promise<Job | null> {
  const row = await db.prepare(`${JOB_SELECT} WHERE j.id = ?`).bind(id).first<JobRow>();
  return row ? toJob(row) : null;
}

export function jobRoutes() {
  const r = new Hono<AppContext>();
  r.use(requireRole("office"));
  r.onError((err, c) => (err instanceof Invalid ? c.json({ error: err.message }, 400) : Promise.reject(err)));

  r.post("/", async (c) => {
    const db = c.env.DB;
    const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, any>;

    const contactExists = async (id: unknown) =>
      typeof id === "string" ? await db.prepare("SELECT id, is_partner FROM contact WHERE id = ?").bind(id).first<{ id: string; is_partner: number }>() : null;

    const customer = (await contactExists(b.customerId)) ?? fail("customer_not_found");
    const payer = b.payerId ? ((await contactExists(b.payerId)) ?? fail("payer_not_found")) : customer;

    const leadChannel = LEAD_CHANNELS.includes(b.leadChannel) ? (b.leadChannel as LeadChannel) : fail("lead_channel_required");
    let partnerId: string | null = null;
    if (leadChannel === "Partner") {
      const partner = await contactExists(b.partnerId);
      if (!partner || partner.is_partner !== 1) fail("partner_required");
      partnerId = partner!.id;
    }

    const line = text(b.serviceAddress?.line) ?? "";
    const suburb = text(b.serviceAddress?.suburb) ?? "";
    if (!line && !suburb) fail("service_address_required");

    const a = b.appliance ?? {};
    const typeIn = text(a.type) ?? fail("appliance_type_required");
    const type = (await canonicalPicklistValue(db, "appliance_type", typeIn!)) ?? fail("unknown_appliance_type");
    const brandIn = text(a.brand);
    const brand = brandIn ? ((await canonicalPicklistValue(db, "brand", brandIn)) ?? fail("unknown_brand")) : null;
    const faultIn = text(b.faultCategory);
    const faultCategory = faultIn ? ((await canonicalPicklistValue(db, "fault_category", faultIn)) ?? fail("unknown_fault_category")) : null;
    const reportedFault = text(b.reportedFault) ?? fail("reported_fault_required");
    const purchaseDate = isoDate(a.purchaseDate);

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO job (id, number, status, customer_id, payer_id, partner_id, service_line, service_suburb, lead_channel,
           partner_reference, payer_reference, warranty, appliance_type, brand, model, serial_number, purchase_date,
           reported_fault, fault_category, created_at, created_by)
         VALUES (?, (SELECT COALESCE(MAX(number), 1000) + 1 FROM job), 'New', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, customer.id, payer.id, partnerId, line, suburb, leadChannel, text(b.partnerReference), text(b.payerReference),
        b.warranty === true ? 1 : 0, type, brand, upper(a.model), upper(a.serialNumber), purchaseDate, reportedFault, faultCategory,
        c.var.deps.clock.now(), c.var.user.id,
      )
      .run();
    return c.json(await loadJob(db, id), 201);
  });

  r.get("/:id", async (c) => {
    const job = await loadJob(c.env.DB, c.req.param("id"));
    return job ? c.json(job) : c.json({ error: "not_found" }, 404);
  });

  return r;
}

/** Jobs a Contact appears on, newest first, with the role(s) they play. */
export async function jobsForContact(db: D1Database, contactId: string) {
  const { results } = await db
    .prepare(
      `SELECT id, number, status, created_at, appliance_type, reported_fault, customer_id, payer_id, partner_id FROM job
       WHERE customer_id = ?1 OR payer_id = ?1 OR partner_id = ?1 ORDER BY number DESC LIMIT 100`,
    )
    .bind(contactId)
    .all<{ id: string; number: number; status: string; created_at: number; appliance_type: string; reported_fault: string; customer_id: string; payer_id: string; partner_id: string | null }>();
  return results.map((j) => ({
    id: j.id,
    number: j.number,
    status: j.status,
    createdAt: j.created_at,
    applianceType: j.appliance_type,
    reportedFault: j.reported_fault,
    roles: [j.customer_id === contactId && "Customer", j.payer_id === contactId && "Payer", j.partner_id === contactId && "Partner"].filter(
      (x): x is string => Boolean(x),
    ),
  }));
}
