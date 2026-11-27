# Zoho Books stays the ledger of record

The app owns the lifecycle of a **Job** and its **Visits**. It does not issue tax invoices, record payments or hold accounting data. **Quotes** are created from the app as Zoho Books estimates, and when a **Private Job** is ready to bill the app pushes it to Zoho Books, which produces the VAT invoice to the **Payer** and remains the single source of truth for money (SARS, VAT201, reconciliation).

**Warranty Jobs** are the exception: SMEG is paid through a monthly **Warranty Claim** spreadsheet, which the app generates from its completed **Warranty Jobs**. Other partners (e.g. Azoza) are invoiced through Zoho Books like any other **Payer**.

## Considered Options

- Do invoicing and quoting inside the app: rejected, because it duplicates SARS/VAT compliance work that Zoho Books already does correctly.
- Build on top of Bigin as the job store: rejected, because Bigin's pipeline model is a poor fit for multi-visit repair jobs and would limit the technician interface.
