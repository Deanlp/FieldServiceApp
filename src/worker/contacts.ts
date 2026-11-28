import { Hono } from "hono";
import { nationalForm, normaliseSaPhone, searchDigits } from "../domain/phone";
import type { AppContext } from "./app";
import { normaliseEmail, requireRole } from "./auth";
import { jobsForContact } from "./jobs";

export interface Address {
  line: string;
  suburb: string;
}

export interface Contact {
  id: string;
  kind: "person" | "organisation";
  name: string;
  phones: string[];
  email: string | null;
  addresses: Address[];
  isPartner: boolean;
}

export interface DuplicateWarning {
  field: "phone" | "email";
  value: string;
  contactId: string;
  contactName: string;
}

type ContactInput = Omit<Contact, "id">;
type ContactRow = { id: string; kind: Contact["kind"]; name: string; email: string | null; is_partner: number };

class InvalidInput extends Error {
  constructor(public body: Record<string, unknown>) {
    super("invalid input");
  }
}

function parseInput(raw: unknown): ContactInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const kind = b.kind === "organisation" ? "organisation" : b.kind === "person" ? "person" : null;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const phonesIn = Array.isArray(b.phones) ? b.phones.filter((p): p is string => typeof p === "string" && p.trim() !== "") : [];
  if (!kind || !name || phonesIn.length === 0) throw new InvalidInput({ error: "kind_name_and_phone_required" });

  const phones: string[] = [];
  for (const p of phonesIn) {
    const e164 = normaliseSaPhone(p);
    if (!e164) throw new InvalidInput({ error: "invalid_phone", value: p });
    if (!phones.includes(e164)) phones.push(e164);
  }
  const email = normaliseEmail(b.email) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new InvalidInput({ error: "invalid_email", value: b.email });

  const addresses = (Array.isArray(b.addresses) ? b.addresses : [])
    .map((a) => ({ line: String(a?.line ?? "").trim(), suburb: String(a?.suburb ?? "").trim() }))
    .filter((a) => a.line || a.suburb);

  return { kind, name, phones, email, addresses, isPartner: b.isPartner === true };
}

export async function loadContacts(db: D1Database, ids: string[]): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const marks = ids.map(() => "?").join(",");
  const [rows, phones, addresses] = await db.batch([
    db.prepare(`SELECT id, kind, name, email, is_partner FROM contact WHERE id IN (${marks})`).bind(...ids),
    db.prepare(`SELECT contact_id, e164 FROM contact_phone WHERE contact_id IN (${marks}) ORDER BY position`).bind(...ids),
    db.prepare(`SELECT contact_id, line, suburb FROM contact_address WHERE contact_id IN (${marks}) ORDER BY position`).bind(...ids),
  ]);
  const byId = new Map(
    (rows!.results as ContactRow[]).map((r) => [
      r.id,
      { id: r.id, kind: r.kind, name: r.name, email: r.email, isPartner: r.is_partner === 1, phones: [] as string[], addresses: [] as Address[] },
    ]),
  );
  for (const p of phones!.results as { contact_id: string; e164: string }[]) byId.get(p.contact_id)?.phones.push(p.e164);
  for (const a of addresses!.results as { contact_id: string; line: string; suburb: string }[]) {
    byId.get(a.contact_id)?.addresses.push({ line: a.line, suburb: a.suburb });
  }
  return ids.map((id) => byId.get(id)).filter((c): c is Contact => c !== undefined);
}

async function duplicateWarnings(db: D1Database, input: ContactInput, selfId: string): Promise<DuplicateWarning[]> {
  const warnings: DuplicateWarning[] = [];
  for (const phone of input.phones) {
    const other = await db
      .prepare("SELECT c.id, c.name FROM contact_phone p JOIN contact c ON c.id = p.contact_id WHERE p.e164 = ? AND c.id != ? LIMIT 1")
      .bind(phone, selfId)
      .first<{ id: string; name: string }>();
    if (other) warnings.push({ field: "phone", value: phone, contactId: other.id, contactName: other.name });
  }
  if (input.email) {
    const other = await db
      .prepare("SELECT id, name FROM contact WHERE email = ? AND id != ? LIMIT 1")
      .bind(input.email, selfId)
      .first<{ id: string; name: string }>();
    if (other) warnings.push({ field: "email", value: input.email, contactId: other.id, contactName: other.name });
  }
  return warnings;
}

function writeStatements(db: D1Database, id: string, input: ContactInput): D1PreparedStatement[] {
  return [
    db.prepare("DELETE FROM contact_phone WHERE contact_id = ?").bind(id),
    db.prepare("DELETE FROM contact_address WHERE contact_id = ?").bind(id),
    ...input.phones.map((e164, i) =>
      db.prepare("INSERT INTO contact_phone (contact_id, position, e164, national) VALUES (?, ?, ?, ?)").bind(id, i, e164, nationalForm(e164)),
    ),
    ...input.addresses.map((a, i) =>
      db.prepare("INSERT INTO contact_address (contact_id, position, line, suburb) VALUES (?, ?, ?, ?)").bind(id, i, a.line, a.suburb),
    ),
  ];
}

/** Office-only Contact search, create, view and edit. */
export function contactRoutes() {
  const r = new Hono<AppContext>();
  r.use(requireRole("office"));

  r.onError((err, c) => {
    if (err instanceof InvalidInput) return c.json(err.body, 400);
    throw err;
  });

  r.get("/", async (c) => {
    if (c.req.query("partners") === "true") {
      const { results } = await c.env.DB.prepare("SELECT id FROM contact WHERE is_partner = 1 ORDER BY name").all<{ id: string }>();
      return c.json(await loadContacts(c.env.DB, results.map((x) => x.id)));
    }
    const q = (c.req.query("q") ?? "").trim();
    if (q.length < 2) return c.json([]);
    const db = c.env.DB;
    const looksLikePhone = /^[+\d\s()\-.]+$/.test(q);
    const { results } = looksLikePhone
      ? await db
          .prepare("SELECT DISTINCT c.id FROM contact c JOIN contact_phone p ON p.contact_id = c.id WHERE p.national LIKE ? ORDER BY c.name LIMIT 20")
          .bind(`%${searchDigits(q)}%`)
          .all<{ id: string }>()
      : await db
          .prepare("SELECT id FROM contact WHERE name LIKE ?1 OR email LIKE ?1 ORDER BY name LIMIT 20")
          .bind(`%${q.replace(/[%_]/g, "")}%`)
          .all<{ id: string }>();
    return c.json(await loadContacts(db, results.map((x) => x.id)));
  });

  r.post("/", async (c) => {
    const input = parseInput(await c.req.json().catch(() => null));
    const id = crypto.randomUUID();
    const warnings = await duplicateWarnings(c.env.DB, input, id);
    const now = c.var.deps.clock.now();
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO contact (id, kind, name, email, is_partner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
        id, input.kind, input.name, input.email, input.isPartner ? 1 : 0, now, now,
      ),
      ...writeStatements(c.env.DB, id, input),
    ]);
    const [contact] = await loadContacts(c.env.DB, [id]);
    return c.json({ contact, warnings }, 201);
  });

  r.get("/:id/jobs", async (c) => c.json(await jobsForContact(c.env.DB, c.req.param("id"))));

  r.get("/:id", async (c) => {
    const [contact] = await loadContacts(c.env.DB, [c.req.param("id")]);
    return contact ? c.json(contact) : c.json({ error: "not_found" }, 404);
  });

  r.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const input = parseInput(await c.req.json().catch(() => null));
    const exists = await c.env.DB.prepare("SELECT 1 FROM contact WHERE id = ?").bind(id).first();
    if (!exists) return c.json({ error: "not_found" }, 404);
    const warnings = await duplicateWarnings(c.env.DB, input, id);
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE contact SET kind = ?, name = ?, email = ?, is_partner = ?, updated_at = ? WHERE id = ?").bind(
        input.kind, input.name, input.email, input.isPartner ? 1 : 0, c.var.deps.clock.now(), id,
      ),
      ...writeStatements(c.env.DB, id, input),
    ]);
    const [contact] = await loadContacts(c.env.DB, [id]);
    return c.json({ contact, warnings });
  });

  return r;
}
