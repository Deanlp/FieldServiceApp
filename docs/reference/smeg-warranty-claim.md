# SMEG Warranty Claim: cover sheet format and rules

Source: SMEG SA's "Cover Page Sample.xlsx" and claim instructions (Service Administrator, Claims Submission emails, 2026), and Happy Home's own cover sheet of 06/11/2026. The app must generate this sheet exactly. No customer data is stored in this repo.

## Sheet layout

- Row 1: company details and banking details (Happy Home Appliance Repairs (Pty) Ltd, bank, branch, account number).
- Row 2: `COVERSHEET SUMMARY    DATE: dd/mm/yyyy`
- Row 3 headers, one row per **Warranty Job**, sorted by ticket number ascending:

| Column | Header | Source in the app |
|---|---|---|
| A | Date | Date of the last **Visit** (intervention date) |
| B | Client | **Customer** name |
| C | Ticket # | **Partner Reference** (SMEG ticket number; may be several joined with ` / `) |
| D | Description of repair | Short repair summary (work done / parts fitted) |
| E | Town/City | Suburb of the **Customer** address |
| F | Rate | SMEG intervention rate (currently R425; configurable) |
| G | Total km travel | Sum of round-trip km across all **Visits** on the **Job** |
| H | 120km – 200km | R450 if any single round trip exceeded 120 km, else 0 (once per ticket) |
| I | Travel amount (after 200km) | Excess km beyond 200 per trip × R5.50 |
| J | Travel time (after 200km) | Excess km ÷ 100 × R150 per hour; 50–90 km excess = 0.5 h; under 50 km = 0 |
| K | Extras | Sum of claimable extras (consumables, exchange, extra manpower, tolls, extra trips' R450 band) |
| L | Total | `=SUM(F:K)` for the row, excluding VAT |
| M | Notes | Visits made, parts fitted (part numbers), extras justification, linked tickets |

Formulas from the instructions as written; confirm the excess-km rule for multiple trips in the spec (second trip's R450 goes into Extras, not column H).

## Business rules

- **Claim Period** runs from the 6th of the previous month to the 5th of the current month. Submission due by the 10th, by email to the SMEG Service Administrator, cc the service manager.
- Only the cover sheet is sent; supporting documents (receipts, photos) are uploaded to the ticket on SMEG's SSC portal.
- A ticket is payable only when SSC shows **Closed confirmed**. Unpayable tickets roll to the next claim.
- Tickets must be claimed within **60 days** of the intervention date or are forfeited.
- Used warranty spares must be returned (or photographed, for outlying areas) before the deadline.
- Exchange / loan units must be returned within **14 days** of completion or SMEG invoices the agent; the ticket is not paid until returned.

## Readiness checks the app should run before a Job goes on a claim

Taken from the "Check before adding" tab of the 06/11 sheet:

- Warranty flag on the **Job** matches the service report (no "out of warranty" note).
- Serial number matches the appliance type.
- Parts confirmed and fitted (not still at assessment).
- Not already on a previous claim.
- Within 60 days, SSC closed confirmed, spares/exchange unit returned.
