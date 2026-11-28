import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "./api";
import { ContactJobs, JobView, NewJob } from "./Jobs";

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
interface Warning {
  field: "phone" | "email";
  value: string;
  contactId: string;
  contactName: string;
}

/** "+27821234567" -> "082 123 4567" */
export const displayPhone = (e164: string) => {
  const n = `0${e164.slice(3)}`;
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
};

export function Contacts() {
  const [view, setView] = useState<
    | { mode: "search" }
    | { mode: "new"; phone: string }
    | { mode: "show"; id: string; warnings?: Warning[] }
    | { mode: "newJob"; customer: Contact }
    | { mode: "job"; id: string }
  >({ mode: "search" });

  if (view.mode === "newJob")
    return (
      <NewJob
        customer={view.customer}
        onCancel={() => setView({ mode: "show", id: view.customer.id })}
        onCreated={(job) => setView({ mode: "job", id: job.id })}
      />
    );
  if (view.mode === "job")
    return <JobView id={view.id} onBack={() => setView({ mode: "search" })} onOpenContact={(id) => setView({ mode: "show", id })} />;

  if (view.mode === "new")
    return (
      <ContactForm
        initial={{ kind: "person", name: "", phones: [view.phone], email: null, addresses: [{ line: "", suburb: "" }], isPartner: false }}
        onCancel={() => setView({ mode: "search" })}
        onSaved={(c, warnings) => setView({ mode: "show", id: c.id, warnings })}
      />
    );
  if (view.mode === "show")
    return (
      <ContactView
        id={view.id}
        warnings={view.warnings}
        onBack={() => setView({ mode: "search" })}
        onOpen={(id) => setView({ mode: "show", id })}
        onNewJob={(customer) => setView({ mode: "newJob", customer })}
        onOpenJob={(id) => setView({ mode: "job", id })}
      />
    );
  return <ContactSearch onOpen={(id) => setView({ mode: "show", id })} onNew={(phone) => setView({ mode: "new", phone })} />;
}

function ContactSearch({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: (phone: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const latest = useRef("");

  useEffect(() => {
    latest.current = q;
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => {
      api<Contact[]>("GET", `/contacts?q=${encodeURIComponent(q)}`).then((r) => latest.current === q && setResults(r));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const looksLikePhone = /^[+\d\s()\-.]{3,}$/.test(q.trim());

  return (
    <section className="stack">
      <label>
        Find a contact
        <input autoFocus type="search" placeholder="Phone number, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <ul className="list">
        {results.map((c) => (
          <li key={c.id} className="clickable" onClick={() => onOpen(c.id)}>
            <div>
              <strong>{c.name}</strong>
              {c.isPartner && <span className="tag">Partner</span>}
              <div className="muted small">
                {c.phones.map(displayPhone).join(" · ")}
                {c.addresses[0]?.suburb ? ` · ${c.addresses[0].suburb}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {q.trim().length >= 2 && results.length === 0 && <p className="muted">No matching contact.</p>}
      <button className={results.length ? "secondary" : ""} onClick={() => onNew(looksLikePhone ? q.trim() : "")}>
        New contact{looksLikePhone && results.length === 0 ? ` for ${q.trim()}` : ""}
      </button>
    </section>
  );
}

function ContactView({
  id, warnings, onBack, onOpen, onNewJob, onOpenJob,
}: {
  id: string; warnings?: Warning[]; onBack: () => void; onOpen: (id: string) => void; onNewJob: (c: Contact) => void; onOpenJob: (id: string) => void;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [shownWarnings, setShownWarnings] = useState(warnings ?? []);

  useEffect(() => {
    api<Contact>("GET", `/contacts/${id}`).then(setContact);
    setShownWarnings(warnings ?? []);
  }, [id]);

  if (!contact) return <p className="muted">Loading…</p>;
  if (editing)
    return (
      <ContactForm
        initial={contact}
        onCancel={() => setEditing(false)}
        onSaved={(c, w) => {
          setContact(c);
          setShownWarnings(w);
          setEditing(false);
        }}
      />
    );

  return (
    <section className="stack">
      <button className="link back" onClick={onBack}>← Contacts</button>
      <WarningList warnings={shownWarnings} onOpen={onOpen} />
      <div className="card stack">
        <h2>
          {contact.name} {contact.isPartner && <span className="tag">Partner</span>}
        </h2>
        <p className="muted small">{contact.kind === "person" ? "Person" : "Organisation"}</p>
        {contact.phones.map((p) => (
          <a key={p} href={`tel:${p}`} className="big-link">{displayPhone(p)}</a>
        ))}
        {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
        {contact.addresses.map((a, i) => (
          <p key={i}>
            {a.line}
            {a.suburb && <><br />{a.suburb}</>}
          </p>
        ))}
        <button className="secondary" onClick={() => setEditing(true)}>Edit</button>
      </div>
      <button onClick={() => onNewJob(contact)}>New Job</button>
      <h3>Jobs</h3>
      <ContactJobs contactId={contact.id} onOpen={onOpenJob} />
    </section>
  );
}

function WarningList({ warnings, onOpen }: { warnings: Warning[]; onOpen: (id: string) => void }) {
  if (warnings.length === 0) return null;
  return (
    <div className="warning" role="status">
      <strong>Possible duplicate</strong>
      {warnings.map((w, i) => (
        <p key={i}>
          This {w.field === "phone" ? `number (${displayPhone(w.value)})` : `email (${w.value})`} also belongs to{" "}
          <button className="link inline" onClick={() => onOpen(w.contactId)}>{w.contactName}</button>.
        </p>
      ))}
    </div>
  );
}

function ContactForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Omit<Contact, "id"> & { id?: string };
  onCancel: () => void;
  onSaved: (c: Contact, warnings: Warning[]) => void;
}) {
  const [kind, setKind] = useState(initial.kind);
  const [name, setName] = useState(initial.name);
  const [phones, setPhones] = useState(initial.phones.length ? initial.phones.map((p) => (p.startsWith("+27") ? displayPhone(p) : p)) : [""]);
  const [email, setEmail] = useState(initial.email ?? "");
  const [line, setLine] = useState(initial.addresses[0]?.line ?? "");
  const [suburb, setSuburb] = useState(initial.addresses[0]?.suburb ?? "");
  const [isPartner, setIsPartner] = useState(initial.isPartner);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      kind,
      name,
      phones: phones.filter((p) => p.trim()),
      email: email || null,
      addresses: [{ line, suburb }, ...initial.addresses.slice(1)],
      isPartner: kind === "organisation" && isPartner,
    };
    try {
      const res = initial.id
        ? await api<{ contact: Contact; warnings: Warning[] }>("PATCH", `/contacts/${initial.id}`, body)
        : await api<{ contact: Contact; warnings: Warning[] }>("POST", "/contacts", body);
      onSaved(res.contact, res.warnings);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(
        code === "invalid_phone"
          ? "One of the phone numbers isn't a valid South African number."
          : code === "invalid_email"
            ? "That email address doesn't look right."
            : code === "kind_name_and_phone_required"
              ? "A name and at least one phone number are needed."
              : "Couldn't save. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="stack">
      <h2>{initial.id ? "Edit contact" : "New contact"}</h2>
      <div className="segmented">
        <button type="button" className={kind === "person" ? "" : "secondary"} onClick={() => setKind("person")}>Person</button>
        <button type="button" className={kind === "organisation" ? "" : "secondary"} onClick={() => setKind("organisation")}>Organisation</button>
      </div>
      <label>
        Name
        <input required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      {phones.map((p, i) => (
        <label key={i}>
          {i === 0 ? "Phone" : `Phone ${i + 1}`}
          <input type="tel" inputMode="tel" required={i === 0} value={p} onChange={(e) => setPhones(phones.map((x, j) => (j === i ? e.target.value : x)))} />
        </label>
      ))}
      <button type="button" className="link" onClick={() => setPhones([...phones, ""])}>+ Another phone number</button>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Street address
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="e.g. 12 Oak Road, Unit 4 Seaview" />
      </label>
      <label>
        Suburb
        <input value={suburb} onChange={(e) => setSuburb(e.target.value)} />
      </label>
      {kind === "organisation" && (
        <label className="checkbox">
          <input type="checkbox" checked={isPartner} onChange={(e) => setIsPartner(e.target.checked)} />
          This organisation is a Partner (sends us leads)
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
