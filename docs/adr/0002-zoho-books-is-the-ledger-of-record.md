# Zoho Books stays the ledger of record

The app owns the lifecycle of a **Job** and its **Visits**. It does not issue tax invoices, record payments or hold accounting data. When a **Job** is ready to bill, the app pushes it to Zoho Books, which produces the VAT invoice and remains the single source of truth for money (SARS, VAT201, reconciliation).

## Considered Options

- Do invoicing inside the app: rejected, because it duplicates SARS/VAT compliance work that Zoho Books already does correctly.
- Build on top of Bigin as the job store: rejected, because Bigin's pipeline model is a poor fit for multi-visit repair jobs and would limit the technician interface.
