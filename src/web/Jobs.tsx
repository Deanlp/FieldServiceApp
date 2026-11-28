import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Contact } from "./Contacts";

export const LEAD_CHANNELS = ["Partner", "Website", "Google", "Repeat", "Word of mouth", "Other"] as const;
type Picklists = { applianceType: string[]; brand: string[]; faultCategory: string[] };
type ListKey = keyof Picklists;
const LIST_ROUTE: Record<ListKey, string> = { applianceType: "appliance-type", brand: "brand", faultCategory: "fault-category" };

export interface Job {
  id: string;
  number: number;
  status: string;
  customer: { id: string; name: string };
  payer: { id: string; name: string };
  partner: { id: string; name: string } | null;
  serviceAddress: { line: string; suburb: string };
  leadChannel: string;
  partnerReference: string | null;
  payerReference: string | null;
  warranty: boolean;
  appliance: { type: string; brand: string | null; model: string | null; serialNumber: string | null; purchaseDate: string | null };
  reportedFault: string;
  faultCategory: string | null;
  createdAt: number;
}

export interface ContactJob {
  id: string;
  number: number;
  status: string;
  createdAt: number;
  applianceType: string;
  reportedFault: string;
  roles: string[];
}

const ERRORS: Record<string, string> = {
  lead_channel_required: "Choose how the lead came in.",
  partner_required: "Choose which Partner sent this lead.",
  appliance_type_required: "Choose the appliance type.",
  reported_fault_required: "Describe the reported fault.",
  service_address_required: "Enter the service address.",
  invalid_purchase_date: "The purchase date isn't a real date.",
  payer_not_found: "The Payer couldn't be found.",
};

function PicklistSelect({
  label, list, value, onChange, lists, onListsChange, required,
}: {
  label: string; list: ListKey; value: string; onChange: (v: string) => void; lists: Picklists; onListsChange: () => Promise<void>; required?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        required={required}
        value={value}
        onChange={async (e) => {
          if (e.target.value !== "__add") return onChange(e.target.value);
          const added = prompt(`Add a new ${label.toLowerCase()}`)?.trim();
          if (!added) return;
          const res = await api<{ value: string }>("POST", `/picklists/${LIST_ROUTE[list]}`, { value: added });
          await onListsChange();
          onChange(res.value);
        }}
      >
        <option value="">{required ? "Choose…" : "—"}</option>
        {lists[list].map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
        <option value="__add">+ Add new…</option>
      </select>
    </label>
  );
}

export function NewJob({ customer, onCancel, onCreated }: { customer: Contact; onCancel: () => void; onCreated: (job: Job) => void }) {
  const [lists, setLists] = useState<Picklists>({ applianceType: [], brand: [], faultCategory: [] });
  const [partners, setPartners] = useState<Contact[]>([]);
  const [line, setLine] = useState(customer.addresses[0]?.line ?? "");
  const [suburb, setSuburb] = useState(customer.addresses[0]?.suburb ?? "");
  const [type, setType] = useState("");
  const [fault, setFault] = useState("");
  const [leadChannel, setLeadChannel] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerReference, setPartnerReference] = useState("");
  const [warranty, setWarranty] = useState(false);
  const [more, setMore] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [faultCategory, setFaultCategory] = useState("");
  const [payer, setPayer] = useState<Contact>(customer);
  const [payerReference, setPayerReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadLists = () => api<Picklists>("GET", "/picklists").then(setLists);
  useEffect(() => {
    loadLists();
    api<Contact[]>("GET", "/contacts?partners=true").then(setPartners);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const job = await api<Job>("POST", "/jobs", {
        customerId: customer.id,
        payerId: payer.id,
        serviceAddress: { line, suburb },
        leadChannel,
        partnerId: leadChannel === "Partner" ? partnerId : undefined,
        partnerReference,
        payerReference,
        warranty,
        appliance: { type, brand, model, serialNumber: serial, purchaseDate },
        reportedFault: fault,
        faultCategory,
      });
      onCreated(job);
    } catch (err) {
      setError((err instanceof ApiError && ERRORS[err.code]) || "Couldn't create the Job. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="stack">
      <h2>New Job for {customer.name}</h2>
      <div className="row">
        <label>
          Street address
          <input value={line} onChange={(e) => setLine(e.target.value)} />
        </label>
        <label>
          Suburb
          <input value={suburb} onChange={(e) => setSuburb(e.target.value)} />
        </label>
      </div>
      <PicklistSelect label="Appliance" list="applianceType" value={type} onChange={setType} lists={lists} onListsChange={loadLists} required />
      <label>
        Reported fault
        <textarea required rows={2} value={fault} onChange={(e) => setFault(e.target.value)} />
      </label>
      <fieldset className="stack">
        <legend>How did the lead come in?</legend>
        <div className="chips">
          {LEAD_CHANNELS.map((ch) => (
            <button type="button" key={ch} className={leadChannel === ch ? "" : "secondary"} onClick={() => setLeadChannel(ch)}>
              {ch}
            </button>
          ))}
        </div>
      </fieldset>
      {leadChannel === "Partner" && (
        <div className="row">
          <label>
            Partner
            <select required value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">Choose…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Partner reference
            <input value={partnerReference} onChange={(e) => setPartnerReference(e.target.value)} placeholder="e.g. SMEG ticket no." />
          </label>
        </div>
      )}
      <div className="segmented">
        <button type="button" className={warranty ? "secondary" : ""} onClick={() => setWarranty(false)}>Private Job</button>
        <button type="button" className={warranty ? "" : "secondary"} onClick={() => setWarranty(true)}>Warranty Job</button>
      </div>

      <button type="button" className="link" onClick={() => setMore(!more)}>
        {more ? "− Fewer details" : "+ Brand, model, serial, Payer…"}
      </button>
      {more && (
        <div className="stack card">
          <div className="row">
            <PicklistSelect label="Brand" list="brand" value={brand} onChange={setBrand} lists={lists} onListsChange={loadLists} />
            <PicklistSelect label="Fault category" list="faultCategory" value={faultCategory} onChange={setFaultCategory} lists={lists} onListsChange={loadLists} />
          </div>
          <div className="row">
            <label>
              Model
              <input value={model} onChange={(e) => setModel(e.target.value.toUpperCase())} />
            </label>
            <label>
              Serial number
              <input value={serial} onChange={(e) => setSerial(e.target.value.toUpperCase())} />
            </label>
          </div>
          <label>
            Purchase date
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </label>
          <PayerPicker payer={payer} customer={customer} onChange={setPayer} />
          <label>
            Payer reference (work order / PO)
            <input value={payerReference} onChange={(e) => setPayerReference(e.target.value)} />
          </label>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button disabled={busy}>{busy ? "Creating…" : "Create Job"}</button>
      </div>
    </form>
  );
}

function PayerPicker({ payer, customer, onChange }: { payer: Contact; customer: Contact; onChange: (c: Contact) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => api<Contact[]>("GET", `/contacts?q=${encodeURIComponent(q)}`).then(setResults), 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="stack">
      <p>
        <strong>Payer:</strong> {payer.name}
        {payer.id !== customer.id && (
          <button type="button" className="link inline" onClick={() => onChange(customer)}> (reset to Customer)</button>
        )}
      </p>
      <label>
        Someone else pays? Find the owner or managing agent
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Phone number, name or email" />
      </label>
      {results.length > 0 && (
        <ul className="list">
          {results.map((c) => (
            <li key={c.id} className="clickable" onClick={() => { onChange(c); setQ(""); }}>
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function JobView({ id, onBack, onOpenContact }: { id: string; onBack: () => void; onOpenContact: (id: string) => void }) {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    api<Job>("GET", `/jobs/${id}`).then(setJob);
  }, [id]);
  if (!job) return <p className="muted">Loading…</p>;
  const a = job.appliance;
  return (
    <section className="stack">
      <button className="link back" onClick={onBack}>← Back</button>
      <div className="card stack">
        <h2>
          Job {job.number} <span className="tag">{job.status}</span> <span className="tag">{job.warranty ? "Warranty" : "Private"}</span>
        </h2>
        <p>
          <strong>{a.type}</strong>
          {a.brand ? ` · ${a.brand}` : ""}
          {a.model ? ` · ${a.model}` : ""}
          {a.serialNumber ? ` · S/N ${a.serialNumber}` : ""}
        </p>
        <p>{job.reportedFault}</p>
        {job.faultCategory && <p className="muted small">Fault category: {job.faultCategory}</p>}
      </div>
      <div className="card stack">
        <p>
          <strong>Customer:</strong> <button className="link inline" onClick={() => onOpenContact(job.customer.id)}>{job.customer.name}</button>
        </p>
        <p>{job.serviceAddress.line}{job.serviceAddress.suburb ? `, ${job.serviceAddress.suburb}` : ""}</p>
        <p>
          <strong>Payer:</strong> <button className="link inline" onClick={() => onOpenContact(job.payer.id)}>{job.payer.name}</button>
          {job.payerReference ? ` · Ref ${job.payerReference}` : ""}
        </p>
        <p>
          <strong>Lead:</strong> {job.leadChannel}
          {job.partner && <> · <button className="link inline" onClick={() => onOpenContact(job.partner!.id)}>{job.partner.name}</button></>}
          {job.partnerReference ? ` · Ref ${job.partnerReference}` : ""}
        </p>
        {a.purchaseDate && <p className="muted small">Purchased {a.purchaseDate}</p>}
      </div>
    </section>
  );
}

export function ContactJobs({ contactId, onOpen }: { contactId: string; onOpen: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<ContactJob[] | null>(null);
  useEffect(() => {
    api<ContactJob[]>("GET", `/contacts/${contactId}/jobs`).then(setJobs);
  }, [contactId]);
  if (!jobs) return null;
  if (jobs.length === 0) return <p className="muted">No Jobs yet.</p>;
  return (
    <ul className="list">
      {jobs.map((j) => (
        <li key={j.id} className="clickable" onClick={() => onOpen(j.id)}>
          <div>
            <strong>Job {j.number}</strong> <span className="tag">{j.status}</span>
            <div className="muted small">
              {j.applianceType} · {j.reportedFault}
              {j.roles.includes("Customer") ? "" : ` · as ${j.roles.join(", ")}`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
