# R1 · Zoho Books API

Research ticket R1: how the app should talk to Zoho Books, the ledger of record (ADR 0002), to push **Contacts** (ADR 0005), create **Quotes** (Zoho estimates) and invoice **Private Jobs** to their **Payer**.

Researched 2026-11-28 against Zoho's own documentation only. Nothing was tested against a live organisation. Points marked **[verify]** need a sandbox call before we rely on them.

## Sources

Every claim below is tagged with one of these source keys.

| Key | Source |
|---|---|
| B-INTRO | https://www.zoho.com/books/api/v3/introduction/ |
| B-OAUTH | https://www.zoho.com/books/api/v3/oauth/ |
| B-ERR | https://www.zoho.com/books/api/v3/errors/ |
| B-PAGE | https://www.zoho.com/books/api/v3/pagination/ |
| B-CONTACTS | https://www.zoho.com/books/api/v3/contacts/ |
| B-CPERSONS | https://www.zoho.com/books/api/v3/contact-persons/ |
| B-EST | https://www.zoho.com/books/api/v3/estimates/ |
| B-INV | https://www.zoho.com/books/api/v3/invoices/ |
| B-ITEMS | https://www.zoho.com/books/api/v3/items/ |
| B-TAX | https://www.zoho.com/books/api/v3/taxes/ |
| B-OAS | https://www.zoho.com/books/api/v3/openapi-all.zip, Zoho's official OpenAPI bundle, linked from the API pages. It renders the same specs as the HTML pages above, and file names (e.g. `contacts.yml`) are given where it was the exact source. |
| O-SELF | https://www.zoho.com/accounts/protocol/oauth/self-client/overview.html |
| O-SELFCODE | https://www.zoho.com/accounts/protocol/oauth/self-client/authorization-code-flow.html |
| O-MULTIDC | https://www.zoho.com/accounts/protocol/oauth/multi-dc.html |
| O-REFRESH | https://www.zoho.com/accounts/protocol/oauth/web-apps/access-token-expiry.html |
| O-LIMITS | https://www.zoho.com/accounts/protocol/oauth/token-limits.html |
| ZA-MIG | https://www.zoho.com/za/books/help/migration/global-to-za-migration.html (Zoho help, not API docs: used only for the SA-edition context) |

---

## 1. Data centres and base URLs

**Books API base URLs** (B-INTRO). Each takes the form `https://www.zohoapis.<dc>/books/v3/`:

| DC | API base | Accounts (OAuth) server (O-MULTIDC) |
|---|---|---|
| US | `https://www.zohoapis.com/books/` | `accounts.zoho.com` |
| EU | `https://www.zohoapis.eu/books/` | `accounts.zoho.eu` |
| IN | `https://www.zohoapis.in/books/` | `accounts.zoho.in` |
| AU | `https://www.zohoapis.com.au/books/` | `accounts.zoho.com.au` |
| JP | `https://www.zohoapis.jp/books/` | `accounts.zoho.jp` |
| CA | `https://www.zohoapis.ca/books/` | `accounts.zohocloud.ca` |
| CN | `https://www.zohoapis.com.cn/books/` | not listed on O-MULTIDC |
| SA (Saudi Arabia) | `https://www.zohoapis.sa/books/` | `accounts.zoho.sa` |
| AE | `https://www.zohoapis.ae/books/` | not listed on O-MULTIDC |

O-MULTIDC also lists a UK accounts server (`accounts.zoho.uk`), but B-INTRO lists no UK Books API domain. The full DC list is published as JSON at `https://accounts.zoho.com/oauth/serverinfo` (O-MULTIDC). Note that `.sa` is **Saudi Arabia**, not South Africa.

**How an organisation's DC is determined**

- For a person: B-INTRO says to check the domain in the browser URL when you are logged in to the Zoho Books web app, and to replace `.com` with that domain in API calls.
- For code: the token response includes `api_domain`, the host to use for all API calls (O-MULTIDC, O-SELFCODE). For server-based clients with multi-DC enabled, the authorisation redirect also carries `location` and `accounts-server` (O-MULTIDC, B-OAUTH).
- The OAuth client must be registered on, and tokens fetched from, the accounts server of the same DC (O-SELFCODE: "The accounts server URL depends on the datacenter where the client is registered").

**Which DC a South African business lands on: uncertain.** None of the primary sources names a South African data centre, and B-INTRO lists none. Zoho runs a separate South Africa *edition* of Books (VAT-ready, ZAR base currency), with migration from the "Global edition" (ZA-MIG). An edition is a tax/feature localisation, though, not a hosting region, and ZA-MIG says nothing about data centres. My expectation is that a Cape Town organisation is on the **US (.com)** DC, possibly **EU (.eu)**, but this is inference, not documented.

**Action:** before building, check the Books web-app URL (`books.zoho.com` vs `books.zoho.eu`), and confirm the organisation is on the **South Africa edition** rather than Global (this matters for VAT fields; see §6). Configure the accounts URL and API base as settings, and record `api_domain` from the token response rather than hard-coding a DC.

---

## 2. OAuth from a Cloudflare Worker (no user present)

### Client type

| Option | Fit for us | Source |
|---|---|---|
| **Self Client, authorization-code flow** | **Recommended.** Built for "backend app-to-app communication" on your own Zoho account with no end-user authorisation. You generate a one-time grant code in the API console, exchange it once for an access token plus a **refresh token**, and the Worker refreshes from then on. | O-SELF, O-SELFCODE |
| Self Client, client-credentials flow | Possible, but "A refresh token won't be provided", so you resend the client-credentials request each time. Not yet checked whether Books accepts these tokens. **[verify]** | O-SELF |
| Server-based client | Needs a browser redirect and consent screen (`access_type=offline` to get a refresh token). That is only useful if many different Zoho organisations connect to the app. We have one. | B-OAUTH |

### One-time setup (Self Client)

1. In the API console (`api-console.zoho.com` on the right DC), create a Self Client to get a Client ID and Client Secret (O-SELF).
2. In the **Generate Code** tab, enter the scopes (comma-separated) and an expiry time ("By default, it is 3 minutes"), then pick the Books organisation if prompted (O-SELFCODE).
3. Within that window, send `POST {accounts-server}/oauth/v2/token` with `client_id`, `client_secret`, `grant_type=authorization_code` and `code`. The response holds `access_token`, `refresh_token`, `api_domain`, `token_type` and `expires_in` (3600) (O-SELFCODE).
4. Store the refresh token, client ID and client secret as Worker secrets. They are never put in D1 in plain text or sent to the client.

### Runtime

- Refresh with `POST {accounts-server}/oauth/v2/token`, passing `client_id`, `client_secret`, `grant_type=refresh_token` and `refresh_token`. The response contains a new `access_token` and `expires_in`, with no new refresh token (O-SELFCODE, O-REFRESH).
- Call the API with the header `Authorization: Zoho-oauthtoken {access_token}`. "The access Token can be passed only in the header and cannot be passed in the request param" (B-OAUTH).
- To revoke a token: `POST {accounts-server}/oauth/v2/token/revoke?token=...` (B-OAUTH).

### Lifetimes and limits

| Token | Lifetime / limit | Source |
|---|---|---|
| Grant code | One-time use. For a Self Client it lasts 3 minutes by default (configurable); for other clients, 2 minutes. At most 10 per 10 minutes per client ID. | O-SELFCODE, B-OAUTH |
| Access token | **1 hour** (`expires_in` 3600) | O-REFRESH, B-OAUTH |
| Access tokens per refresh token | Up to **10 created per 10 minutes**, after which creation is blocked for the rest of the window (O-REFRESH). Active tokens per refresh token: **10** on O-LIMITS, but **15** on B-OAUTH. The sources conflict. | O-REFRESH, O-LIMITS, B-OAUTH |
| Refresh token | Does not expire ("unlimited lifetime until it is revoked by the end-user") | B-OAUTH, O-SELFCODE |
| Refresh tokens per user per client | 20. Creating a 21st invalidates the oldest. | O-LIMITS, B-OAUTH |

**Implication for Workers:** each Worker isolate must not refresh on its own, or a burst of isolates will hit the "10 per 10 minutes" limit. Cache the access token centrally (KV, D1 or a Durable Object), with its expiry, and refresh about 5 minutes early behind a single-flight lock. A Durable Object is the cleanest way to get that lock.

### Scopes

The format is `ZohoBooks.<scope>.<operation>`, where the operation is `CREATE`, `READ`, `UPDATE`, `DELETE` or `ALL` (B-OAUTH). The scopes we need, confirmed per endpoint in B-OAS:

| Need | Scope | Source |
|---|---|---|
| Contacts and contact persons | `ZohoBooks.contacts.CREATE`, `.READ`, `.UPDATE` | B-OAS `contacts.yml`; B-CPERSONS |
| Estimates, including status changes | `ZohoBooks.estimates.CREATE`, `.READ`, `.UPDATE` | B-OAS `estimates.yml` |
| Invoices, including from-estimate | `ZohoBooks.invoices.CREATE`, `.READ`, `.UPDATE` | B-OAS `invoices.yml` |
| Items (`/items`), taxes, organisations | `ZohoBooks.settings.READ` | B-OAUTH ("settings" covers Items, Users, Taxes, Currencies…); B-OAS `items.yml`, `taxes.yml`; B-INTRO (`GET /organizations`) |

B-OAUTH lists no separate "items" scope. However, B-OAS shows a `ZohoBooks.items.*` scope on the newer `/itemmasters` endpoints. We do not need those endpoints.

Suggested grant string: `ZohoBooks.contacts.CREATE,ZohoBooks.contacts.READ,ZohoBooks.contacts.UPDATE,ZohoBooks.estimates.CREATE,ZohoBooks.estimates.READ,ZohoBooks.estimates.UPDATE,ZohoBooks.invoices.CREATE,ZohoBooks.invoices.READ,ZohoBooks.invoices.UPDATE,ZohoBooks.settings.READ`

It deliberately leaves out `DELETE`, so that the app cannot delete ledger records.

### organization_id

"The parameter `organization_id` along with the organization ID should be sent in with every API request." Get it from `GET /organizations` (scope `ZohoBooks.settings.READ`), or from Manage Organizations in the web app (B-INTRO). Treat it as config, alongside the DC.

---

## 3. Contacts

**Endpoints** (B-CONTACTS, B-OAS `contacts.yml`)

- `POST /contacts`: create. The only required field is `contact_name`, the display name, "used for searching and displaying contacts".
- `PUT /contacts/{contact_id}`: update.
- `GET /contacts/{contact_id}`: get.
- `GET /contacts`: list and search.
- `PUT /contacts` with headers `X-Unique-Identifier-Key` (the API name of a custom field), `X-Unique-Identifier-Value`, and optionally `X-Upsert: true`. This updates the contact whose **unique custom field** matches, or **creates it** if none matches and `X-Upsert` is true. The custom field must be configured "to not accept duplicate values". For this endpoint `contact_name` and `contact_type` are required.
- `GET /contacts/reference/{reference_id}`: "Retrieve a contact using its reference ID from an external system". The docs do not say how a reference ID is set. **[verify]**
- `POST /contacts/{contact_id}/merge`: merge duplicates, useful for the one-off import clean-up.

**Person vs company** (B-CONTACTS)

- `contact_type`: `customer` or `vendor`. We always use `customer`.
- `customer_sub_type`: `individual` or `business`. Map a person to `individual`, and an organisation (managing agent, Partner) to `business`.
- `company_name`: "Legal or registered contact's company name", max 200 characters.

**Contact persons** (B-CONTACTS, B-CPERSONS)

- Contact persons can be sent inline on create or update as `contact_persons[]`, with `first_name`, `last_name`, `email`, `phone`, `mobile`, `designation`, `is_primary_contact` and `enable_portal`. Only one can be primary.
- On `PUT /contacts/{id}`, "you can add new contact persons, update existing ones, or remove them by excluding them from the contact_persons list". The list is a **full replacement**, so always send the existing `contact_person_id` values, or Zoho deletes those people (B-OAS `contacts.yml`).
- Separate endpoints exist: `POST /contacts/contactpersons` (with `contact_id` in the body), `PUT` and `DELETE /contacts/contactpersons/{id}`, `GET /contacts/{contact_id}/contactpersons`, and `POST /contacts/contactpersons/{id}/primary` (B-CPERSONS).
- Addresses go in `billing_address` and `shipping_address` (`attention`, `address`, `street2`, `city`, `state`, `zip`, `country`, `phone`). Extra addresses use `/contacts/{id}/address`.
- Custom fields: `custom_fields[]` with `index` and `value` on create (B-OAS `contacts.yml`). The invoice spec uses `customfield_id` and `value` instead, so the shape varies by module. **[verify]**

**Search and matching to avoid duplicates** (B-OAS `contacts.yml`, `GET /contacts`)

- Filters: `contact_name`, `company_name`, `first_name`, `last_name`, `email`, `phone` and `address`, each with `_startswith` and `_contains` variants (max 100 characters). Also `search_text` (name or notes), `contact_type` and `filter_by` (`Status.Active`, `Status.Duplicate`, …), plus `page` and `per_page`.
- **Caveat:** `email`, `phone`, `first_name` and `last_name` match the **primary contact person only**, not every contact person and not the address phone.
- Phone matching is plain string matching. Zoho does no normalisation that the docs mention, so `082 123 4567`, `0821234567` and `+27821234567` are different strings. We must store one canonical format (E.164, e.g. `+27821234567`) when we push, and search on both forms during the launch import.

**Recommendation (fits ADR 0005: the app is master, one-way push)**

1. Create a Books custom field on Contacts, e.g. `cf_app_contact_id`, set to not allow duplicates.
2. Push every contact with `PUT /contacts` and `X-Unique-Identifier-Key: cf_app_contact_id`, `X-Unique-Identifier-Value: <app id>`, `X-Upsert: true`. That makes the push idempotent and retry-safe, with no search-then-create race.
3. Store the returned `contact_id`, and each `contact_person_id`, in D1.
4. Use phone or email search only during the one-off launch import, to link existing Books contacts to app contacts. After linking, write `cf_app_contact_id` onto the Books contact.

---

## 4. Estimates (Quotes) and invoices

### Create

- `POST /estimates` (B-EST) and `POST /invoices` (B-INV). Both require `customer_id` and `line_items[]` (B-OAS). Use `?send=false` on both so that Zoho does not email the Payer by accident; the Office sends documents.
- Line item fields: `item_id`, `name`, `description`, `rate`, `quantity`, `unit`, `discount`, `tax_id`, `item_order`, plus `line_item_category` (`line_item`, `header`, `subtotal`) on estimates (B-OAS `estimates.yml`).
- **Free-text lines:** the estimate spec allows a line with `name`, `description`, `rate` and `quantity` and no `item_id`. The invoice spec's `item_id` description says "This field is required for each line item", yet `item_id` is not in the schema's required list. **[verify]** If invoices reject free-text lines, keep generic catalogue items (e.g. "Labour", "Call-out", "Sundry part") and override `name`, `description` and `rate` on each line.
- Other useful fields: `date`, `expiry_date` (estimate), `due_date` and `payment_terms` (invoice), `notes`, `terms`, `contact_persons_associated[]`, `template_id`, `discount`, `is_discount_before_tax`, and `custom_fields[]`.

### Payer Reference (the customer's PO or work-order number)

- Use **`reference_number`**. On invoices it is documented as "External reference number or identifier for the invoice, such as a purchase order number, contract number…". On estimates it is an "Optional external identifier used to associate the estimate with other systems" (B-OAS `invoices.yml`, `estimates.yml`).
- It is searchable: `GET /estimates?reference_number=…`, and `search_text` covers the estimate number, reference number and customer name (B-OAS `estimates.yml`). There is also `GET /invoices/reference/{reference_id}` (B-OAS `invoices.yml`).
- Use **custom fields** for our own IDs, not the Payer Reference. Add a unique `cf_app_job_id` on estimates and invoices, so that `PUT /estimates` and `PUT /invoices` with `X-Unique-Identifier-*` and `X-Upsert` give the same idempotency as contacts (B-OAS: both endpoints exist). A **Partner Reference** can also go in a custom field if the Office wants it on the PDF.

### Estimate status

- Values: `draft`, `sent`, `invoiced`, `accepted`, `declined`, `expired` (B-OAS `estimates.yml`).
- Writable: `POST /estimates/{id}/status/sent`, `/status/accepted` ("Mark a sent estimate as accepted if the customer has accepted it") and `/status/declined`. There are also approval endpoints: `/submit` and `/approve` (B-EST).
- **Readable:** `GET /estimates/{id}` returns `status`, `accepted_date`, `declined_date`, `is_viewed_by_client`, `client_viewed_time` and `last_modified_time` (B-OAS `estimates.yml`). That means approvals a Payer gives through the Zoho customer portal can be **polled**. Use `GET /estimates?last_modified_time=…` or `status=accepted` to sync changes, then `GET` the detail record. Note that this is a read-back of status only; it does not break ADR 0005, which concerns Contacts.
- Webhooks: none are documented in the v3 API pages reviewed, so plan to poll.

### Converting an estimate to an invoice

- `POST /invoices/fromestimates?estimate_ids=<id,id>` creates invoices from estimates (scope `invoices.CREATE`). Its documented response is only `{code: 0, message: "The invoices have been created."}`, **with no invoice ID**, so we would have to search for the new invoice afterwards (B-OAS `invoices.yml`).
- The preferred alternative is `POST /invoices` with `invoiced_estimate_id` ("Use this field when creating an invoice from an existing estimate… links this invoice back to its source estimate"), plus the final line items (B-OAS `invoices.yml`). This returns the invoice, lets us bill what was actually done (which can differ from the Quote), and keeps the link. Whether this also flips the estimate to `invoiced` is **[verify]**.

---

## 5. Items (parts and labour catalogue)

- `GET /items` lists **active** items, with pagination. `GET /items/{item_id}` gets one, and `GET /itemdetails?item_ids=` fetches several in bulk. The scope is `ZohoBooks.settings.READ` (B-ITEMS, B-OAS `items.yml`).
- Fields: `name`, `sku` ("should be unique"), `description` (max 2000 characters), `rate`, `purchase_rate`, `unit`, `tax_id`, `is_taxable`, `status`, `item_type`, `product_type` and `last_modified_time`. For the South Africa edition, `product_type` is `service`, `goods`, `capital_service` or `capital_goods` (B-OAS `items.yml`).
- Search parameters: `name`, `description` (each with `_startswith` and `_contains`), `rate` ranges, `tax_id`, `search_text` (name or description), `filter_by=Status.Active|Inactive|All`, `sort_column=name|rate|tax_name`, `page` and `per_page`. **No `sku` filter is documented** (B-OAS `items.yml`), so SKU or part-number lookup has to be done on our own cached copy.
- **Pagination** (B-PAGE): use `page` and `per_page`, with 200 records by default. The response has `page_context { page, per_page, has_more_page, … }`. Loop while `has_more_page` is true. No documented maximum for `per_page`, so use 200.

**Caching recommendation**

- Mirror items into a D1 table (`item_id`, `sku`, `name`, `description`, `rate`, `tax_id`, `status`, `synced_at`), indexed on `sku` and on name.
- Refresh it with a Cron Trigger nightly, plus an "Refresh catalogue" button for the Office.
- At a few hundred items, a full refresh is a handful of calls a day. Search is then local, fast and free against the daily quota.
- Always send `item_id` and an explicit `rate` on lines, so that a stale cache can't silently misprice anything: Zoho stores what we send.

---

## 6. Rate limits, errors, VAT

### Rate limits (B-INTRO)

- **100 requests per minute per organisation.**
- Daily limits: Free 1,000; Standard 2,000; Professional 5,000; Premium, Elite and Ultimate 10,000.
- Concurrency: 5 on the Free plan and 10 on paid plans (a soft limit).
- Over a limit, the API returns HTTP **429** with a Books error code: `45` (daily limit), `44` (per-minute limit, after which the organisation is blocked temporarily) or `1070` (too many requests in process).
- **Handling:** use a single outbound queue (Cloudflare Queues or a Durable Object) with concurrency of 2 or less and backoff on 429. Do not retry immediately on a `44`.

### Errors (B-ERR)

- HTTP statuses: 200/201 for success; 400 bad request; 401 unauthorised (invalid token), so refresh once and retry; 404; 405; 429; 500.
- The body is always JSON with an integer `code` and a string `message`. Success also returns `code: 0` (e.g. `{"code":1002,"message":"Invoice does not exist."}`).
- No full list of codes is published. Log `code` and `message` verbatim and show the `message` to the Office.

### VAT (South Africa)

- Tax is set per line with `line_items[].tax_id`. There is also a document-level `tax_id`. IDs come from `GET /settings/taxes` (scope `settings.READ`) (B-OAS `estimates.yml`, `invoices.yml`, `taxes.yml`; B-TAX).
- `is_inclusive_tax` on the estimate or invoice: "When `true`, the specified rates are inclusive of tax… When `false`, the rates are exclusive of tax (tax will be added to the rate)" (B-OAS `invoices.yml`). Choose one convention for the whole app. **Recommend exclusive (`false`)**, sending ex-VAT rates and letting Zoho compute the 15% VAT, so that the ledger owns the VAT maths (ADR 0002).
- Items carry a default `tax_id` and `is_taxable`. Sending `tax_id` explicitly on each line avoids depending on item defaults.
- SA-edition specifics in the spec: `product_type` values `service`, `goods`, `capital_service` and `capital_goods`, and `is_reverse_charge_applied` / Domestic Reverse Charge for `vat_registered` customers (B-OAS `items.yml`, `estimates.yml`, `recurring-expenses.yml`). Many tax fields in the spec are edition-specific (UK, GCC, India, US), so **confirm the organisation is on the South Africa edition** before mapping VAT fields (ZA-MIG).
- Rounding: Zoho computes totals. Store the returned `total`, `tax_total` and line totals, and don't recompute them for display.

---

## 7. Recommended adapter interface (`LedgerAdapter`)

Operations only, with no code. Every write is idempotent through a unique custom field holding the app's ID, and every call goes through one rate-limited queue.

**Connection and config**

1. `getAccessToken()`: return the cached token, or refresh it under a single-flight lock.
2. `getOrganisation()`: confirm `organization_id`, base currency (ZAR), edition and DC at start-up and in health checks.
3. `listTaxes()`: load VAT `tax_id`s for configuration, such as "Standard 15%" and "Zero-rated".

**Contacts (one-way push, ADR 0005)**

4. `upsertContact(appContact)`: return `{ zohoContactId, contactPersonIds }`. Uses `PUT /contacts` with `X-Upsert` on `cf_app_contact_id`, mapping a person to `individual` and an organisation to `business`, and always sending the full `contact_persons` list.
5. `findContactsForImport({ phone?, email?, name? })`: used only for the launch import and linking.
6. `getContact(zohoContactId)`

**Catalogue**

7. `syncItems(since?)`: page through `GET /items` into D1.
8. `getItems(itemIds[])`: bulk fetch through `/itemdetails`, for spot refreshes.

**Quotes (estimates)**

9. `upsertQuote(job, payerContactId, lines, payerReference)`: return `{ estimateId, number, status, total }`, using `?send=false`, `reference_number` = Payer Reference, and `cf_app_job_id`.
10. `getQuote(estimateId)`: status, accepted or declined date, viewed flag and totals.
11. `listChangedQuotes(sinceTimestamp)`: polls on `last_modified_time` to pick up Payer approvals.
12. `markQuoteSent`, `markQuoteAccepted`, `markQuoteDeclined(estimateId)`: for when the Office records a verbal approval.
13. `emailQuote(estimateId)`: optional, only on explicit Office action.

**Invoices**

14. `createInvoiceForJob(job, payerContactId, lines, payerReference, estimateId?)`: return `{ invoiceId, number, status, total }`, using `POST /invoices` with `invoiced_estimate_id` when there was a Quote, plus `?send=false`. Refuse if the Payer is an organisation and there is no Payer Reference (GLOSSARY).
15. `getInvoice(invoiceId)`: status and balance, for display only, since money stays in Zoho.

**Cross-cutting behaviour**

- Map Zoho errors to `{ httpStatus, zohoCode, message, retryable }`, where 429 and 5xx are retryable and 4xx are not.
- Store Zoho IDs in D1 against the app entities.
- Log every request and response, with POPIA-sensitive fields redacted in logs.
- Never call DELETE endpoints.

## Open items to verify in a sandbox

1. The organisation's DC (.com vs .eu) and edition (South Africa vs Global).
2. Whether invoice line items accept free-text lines without `item_id`.
3. The custom-field payload shape per module (`index` vs `customfield_id` vs `api_name`).
4. Whether `POST /invoices` with `invoiced_estimate_id` sets the estimate to `invoiced`.
5. Whether client-credentials Self Client tokens work for Books.
6. The real limit on active access tokens per refresh token (10 vs 15).
