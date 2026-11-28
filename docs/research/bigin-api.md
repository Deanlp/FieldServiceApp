# R2 · Bigin API one-way contact push

Status: research complete, 2026-11-28. Context: [ADR 0005](../adr/0005-app-is-master-for-contacts-one-way-push.md). The app is the master for **Contacts** and pushes them one way to Bigin and to Zoho Books. [ADR 0002](../adr/0002-zoho-books-is-the-ledger-of-record.md) makes Zoho Books the ledger of record.

Sources: only Zoho's own pages (bigin.com developer docs, Zoho Accounts OAuth docs, Zoho Books API docs, and the Bigin and Zoho Books help centres). Each claim has a link to its source. Where the docs say nothing or contradict each other, this note says so instead of guessing.

Terminology: Bigin calls organisations **Companies** in the UI and `Accounts` in the API. Its `Contacts` module holds people. Under our glossary both are **Contacts**: a person **Contact** maps to a Bigin Contact, and an organisation **Contact** (such as a managing agent or a **Partner**) maps to a Bigin Company.

---

## TL;DR

- **Push to Bigin directly**, using `POST /bigin/v2/{Contacts|Accounts}/upsert`, and store the Bigin record id against each **Contact** in the app.
- **Don't rely on the built-in Bigin ↔ Zoho Books integration to get Contacts into Bigin.** Zoho's help pages only document records flowing from Bigin into Books. They also say deletions in Bigin carry through to Books and that a sync runs every two hours. Both behaviours conflict with ADR 0005 and ADR 0002. Leave the integration's contact and company sync off.
- **Auth:** use a server-side Zoho OAuth client with a non-expiring refresh token and access tokens that last one hour. Call the API on the `api_domain` returned with the token. `.sa` is **Saudi Arabia**, not South Africa.
- **One token for both Bigin and Books is not documented.** The scope syntax allows it, but no Zoho page confirms it, so build the token store per service.
- **Limits:** Bigin allows 50k–100k credits per rolling 24 hours, 10 concurrent calls and 100 records per upsert. Zoho Books allows 100 requests a minute and 1k–10k a day. Both return HTTP 429 when a limit is hit.

---

## 1. Base URLs, data centres and OAuth with no user present

### Base URLs

Bigin v2 REST endpoints take the form `{api_domain}/bigin/v2/{module_api_name}`, for example `https://www.zohoapis.com/bigin/v2/Contacts` ([Add records](https://bigin.com/developer/docs/apis/v2/insert-records.html), [Update records](https://www.bigin.com/developer/docs/apis/v2/update-records.html)).

| DC | Accounts server (OAuth) | API domain |
|---|---|---|
| US | `https://accounts.zoho.com` | `https://www.zohoapis.com` |
| EU | `https://accounts.zoho.eu` | `https://www.zohoapis.eu` |
| IN | `https://accounts.zoho.in` | `https://www.zohoapis.in` |
| AU | `https://accounts.zoho.com.au` | `https://www.zohoapis.com.au` |
| CN | `https://accounts.zoho.com.cn` | `https://www.zohoapis.com.cn` |
| JP | `https://accounts.zoho.jp` | `https://www.zohoapis.jp` |
| SA (Saudi Arabia) | `https://accounts.zoho.sa` | `https://www.zohoapis.sa` |
| CA | `https://accounts.zohocloud.ca` | `https://www.zohoapis.ca` |

Source: [Bigin Multi-DC](https://www.bigin.com/developer/docs/apis/multi-dc.html). Zoho Accounts names `.sa` as "Saudi Arabia (SA)" and also lists a UK DC (`accounts.zoho.uk`) ([Zoho OAuth multi-DC](https://www.zoho.com/accounts/protocol/oauth/multi-dc.html)). The Bigin docs don't list a UK DC. No Zoho DC is located in South Africa, so **don't** pick `.sa` because the business is in South Africa. Zoho Books uses the same hosts under `/books/v3`, for example `https://www.zohoapis.com/books/v3`. Its list also includes `.ae` and has no South African DC ([Zoho Books API introduction](https://www.zoho.com/books/api/v3/introduction/)).

**Action:** check which DC the business's Zoho account is on by looking at the domain it signs in at. Don't hard-code the host. Read `api_domain` from the token response ([Bigin refresh token usage](https://bigin.com/developer/docs/apis/v2/self-client-refresh-token-usage.html)), and read `location` and `accounts-server` from the authorisation redirect ([Bigin Multi-DC](https://www.bigin.com/developer/docs/apis/multi-dc.html)).

### OAuth for a server with no user present

- Zoho uses OAuth 2.0 with long-lived refresh tokens. A one-off consent produces a refresh token, and the server then exchanges it for access tokens whenever it needs one:
  - `POST {accounts-server}/oauth/v2/token` with `grant_type=refresh_token`, `client_id`, `client_secret` and `refresh_token`.
  - Send these as form data in production.
  - The response contains `access_token`, `api_domain`, `token_type` and `expires_in` (3600).

  Source: [Bigin refresh token usage](https://bigin.com/developer/docs/apis/v2/self-client-refresh-token-usage.html).
- Send the access token as `Authorization: Zoho-oauthtoken <token>` ([Add records](https://bigin.com/developer/docs/apis/v2/insert-records.html)).
- Access tokens last one hour. A refresh token "remains valid until manually deleted". Each client ID can hold 20 active refresh tokens per user, and each refresh token 15 active access tokens. When the 20-token limit is reached, the oldest refresh token is deleted. Changing the password or disconnecting the app also deletes refresh tokens ([Bigin OAuth FAQ](https://www.bigin.com/developer/docs/apis/v2/oauth-faqs.html)).
- **Token endpoint rate limit:** "five requests per minute using the same client ID and refresh token". Going over it locks the client out with `access_denied` for 10 minutes ([Bigin OAuth FAQ](https://www.bigin.com/developer/docs/apis/v2/oauth-faqs.html)). **Cache the access token for about 55 minutes in a single place, such as a Durable Object or KV with a lock. Don't refresh per request or per Worker isolate.**
- **Self Client** is the simplest setup when no end user is involved. It needs no redirect URI. You generate a code in the API Console, choose 3, 5, 7 or 10 minutes for it to stay valid, choose the **Bigin** portal and organisation, then exchange the code for tokens ([Self client overview](https://www.bigin.com/developer/docs/apis/self-client-overview.html), [Generate code](https://www.bigin.com/developer/docs/apis/v2/self-client-generate-code.html)).
- With the authorisation-code flow, `access_type=offline` is required to get a refresh token ([Zoho Books OAuth](https://www.zoho.com/books/api/v3/oauth/)).
- With multi-DC enabled, the client ID stays the same but each DC gets its own secret by default ([Zoho OAuth multi-DC](https://www.zoho.com/accounts/protocol/oauth/multi-dc.html)). We only need the business's own DC.
- Store the refresh token and client secret as Worker secrets. The FAQ advises storing refresh tokens securely on the backend ([Bigin OAuth FAQ](https://www.bigin.com/developer/docs/apis/v2/oauth-faqs.html)).

### Can one client and refresh token cover Bigin and Zoho Books?

- **Multiple scopes per token are supported.** Scopes take the form `service_name.scope_name.OPERATION`, and "Access tokens can also be generated with multiple scopes … separated by commas" ([Zoho OAuth scope](https://www.zoho.com/developer/oauth/scope.html), [Zoho Accounts scope](https://www.zoho.com/accounts/protocol/oauth/scope.html)).
- **Mixing services in one grant is not documented.** None of these pages gives an example that combines services or explicitly says it is allowed. The Bigin Self Client flow also has you select the **Bigin portal and organisation** when you generate the code ([Generate code](https://www.bigin.com/developer/docs/apis/v2/self-client-generate-code.html)), which suggests a Self Client grant is scoped to one product.
- **Conclusion:** one OAuth *client* (the same client ID and secret) can certainly be used for both products. Whether a single *refresh token* can carry both `ZohoBigin.*` and `ZohoBooks.*` scopes is not confirmed in the primary docs. Test it with a server-based client and a combined scope string. If it fails, hold two refresh tokens, one per product. Build the token cache keyed by service so either outcome works.

### Required scopes

| Purpose | Scope | Source |
|---|---|---|
| Upsert, add or update Bigin Contacts | `ZohoBigin.modules.contacts.ALL`, or `.CREATE` plus `.UPDATE`/`.WRITE` | [Upsert](https://www.bigin.com/developer/docs/apis/v2/upsert-records.html), [Scopes](https://www.bigin.com/developer/docs/apis/v2/scopes.html) |
| Upsert, add or update Bigin Companies | `ZohoBigin.modules.accounts.ALL`, or `.CREATE` plus `.UPDATE`/`.WRITE` | as above |
| Search Bigin records | `ZohoBigin.modules.{module}.READ` **and** `ZohoSearch.securesearch.READ` | [Search records](https://www.bigin.com/developer/docs/apis/v2/search-records.html) |
| Read field metadata (find API names of custom or unique fields) | `ZohoBigin.settings.fields.READ` | [Scopes](https://www.bigin.com/developer/docs/apis/v2/scopes.html) |
| Zoho Books contacts | `ZohoBooks.contacts.CREATE`, `.READ` and `.UPDATE` (plus estimates and invoices under ADR 0002) | [Zoho Books OAuth](https://www.zoho.com/books/api/v3/oauth/) |

Suggested minimal Bigin set: `ZohoBigin.modules.contacts.ALL,ZohoBigin.modules.accounts.ALL,ZohoSearch.securesearch.READ,ZohoBigin.settings.fields.READ`.

---

## 2. Creating and updating Contacts and Companies

| Operation | Endpoint | Notes |
|---|---|---|
| Add | `POST /bigin/v2/{Contacts\|Accounts}` | Up to 100 records per call. The only mandatory field is `Last_Name` for Contacts and `Account_Name` (a string) for Accounts. To link a Contact to a Company, send `"Account_Name": {"id": "<company id>"}`. Every add is duplicate-checked against unique fields. ([Add records](https://bigin.com/developer/docs/apis/v2/insert-records.html)) |
| Update | `PUT /bigin/v2/{module}` (bulk, `id` in each record) or `PUT /bigin/v2/{module}/{id}` | Up to 100 records per call. `id` is required. Use field API names only. Values over the field's maximum length cause an error. ([Update records](https://www.bigin.com/developer/docs/apis/v2/update-records.html)) |
| **Upsert** | `POST /bigin/v2/{module}/upsert` | Up to 100 records per call. If a match is found the record is updated, otherwise it is inserted. The optional `duplicate_check_fields` array sets the order fields are checked in. Without it, system-defined unique fields are checked first, then user-defined ones (fields with "Do not allow duplicate values" set). The response returns `action: "insert"` or `"update"` and `duplicate_field` for each record. ([Upsert](https://www.bigin.com/developer/docs/apis/v2/upsert-records.html)) |

- Both update and upsert accept `trigger`. **Send `"trigger": []`** so the push doesn't fire Bigin workflows such as automatic emails to leads ([Upsert](https://www.bigin.com/developer/docs/apis/v2/upsert-records.html), [Update records](https://www.bigin.com/developer/docs/apis/v2/update-records.html)).
- The upsert page doesn't list which fields are system-defined unique fields for Contacts and Accounts. **Don't depend on the defaults. Always pass `duplicate_check_fields` explicitly.**

### Search by phone or email

Search uses `GET /bigin/v2/{module}/search` with one of these parameters ([Search records](https://www.bigin.com/developer/docs/apis/v2/search-records.html)):

- `email`, which searches all email fields in the module;
- `phone`, which searches "all the phone number fields associated with that module";
- `criteria`, for example `(Mobile:equals:+27…)`. Phone fields support `equals`, `not_equal`, `starts_with` and `in`;
- `word`.

The docs say nothing about how quickly a new record becomes searchable, how phone numbers are normalised, or what a no-match search returns. The status-code page lists 204 for a GET with no content ([Status codes](https://www.bigin.com/developer/docs/apis/v2/status-codes.html)). Treat 204 as "no match".

### Proposed idempotency design

1. Add a custom field in Bigin, such as `App_Contact_ID` on both Contacts and Companies, and set "Do not allow duplicate values" on it. Upsert treats such fields as user-defined unique fields ([Upsert](https://www.bigin.com/developer/docs/apis/v2/upsert-records.html)).
2. Push with `upsert` and `duplicate_check_fields: ["App_Contact_ID"]`. Retries are then idempotent: a repeat call returns `action: "update"` instead of creating a duplicate.
3. Store the returned `details.id` on the **Contact** in the app.
4. For the one-off launch import (ADR 0005: "matched on phone number"), use `search?phone=` to find existing Bigin records and back-fill `App_Contact_ID`. Normalise numbers to E.164 (`+27…`) on both sides first. Search matching is a plain comparison of the stored text, and the docs describe no phone normalisation.
5. Upsert Companies before Contacts, so the Contact's `Account_Name.id` is known when the Contact is pushed.

---

## 3. Zoho's built-in Bigin ↔ Zoho Books integration

| Question | What Zoho's docs say |
|---|---|
| Editions | Express, Premier and Bigin 360. Only an Administrator can set it up. ([Bigin help: Integrating with Zoho Books](https://help.zoho.com/portal/en/kb/bigin/integration/articles/integrating-with-zoho-books)) |
| What syncs | Bigin Companies become Books Customers of type *Business*. Bigin Contacts become Books Customers of type *Individual*. Bigin Companies with their Contacts become Books Customers with Contact Persons. Products become Items. Deals are linked to Books transactions through "Associate Deal" and aren't synced as records. ([Books help: Integrate with Bigin (ZA)](https://www.zoho.com/za/books/help/integrations/bigin.html), [Books help (US)](https://www.zoho.com/us/books/help/integrations/bigin.html)) |
| Which records | Those in a Bigin list view you choose per module, for example "All Companies" or "My Contacts". ([Books help (ZA)](https://www.zoho.com/za/books/help/integrations/bigin.html)) |
| **Direction** | **The step-by-step docs describe only Bigin → Books:** "The data from Bigin will be synced into your Zoho Books organization" ([Books help (US)](https://www.zoho.com/us/books/help/integrations/bigin.html)). The per-record repair option is "Re-sync contact from Bigin". Marketing and intro text say "two-way" or "between both the applications" ([bigin.com integration page](https://www.bigin.com/integrations/zoho-books.html), [Bigin help](https://help.zoho.com/portal/en/kb/bigin/integration/articles/integrating-with-zoho-books)), but no page documents a customer created in Books being created in Bigin. The documented flow from Books back to Bigin is transactions (invoices, estimates and sales orders) appearing against Bigin records ([Bigin help](https://help.zoho.com/portal/en/kb/bigin/integration/articles/integrating-with-zoho-books)). |
| Frequency | Every two hours after the initial sync, plus manual "Sync Now" and "Pause/Resume". No real-time sync is documented. ([Books help (US)](https://www.zoho.com/us/books/help/integrations/bigin.html)) |
| Duplicates | Skip, Clone or Overwrite. The Bigin help says duplicate handling "currently applies to Companies and Companies & Contacts, and not to Contacts". The Books help defines "Skip" as "The new record will be synced into Zoho Books", which is ambiguous. ([Bigin help](https://help.zoho.com/portal/en/kb/bigin/integration/articles/integrating-with-zoho-books), [Books help (US)](https://www.zoho.com/us/books/help/integrations/bigin.html)) |
| Deletions | "Any record deleted in Bigin will also be deleted from Books or Invoice." ([Bigin help](https://help.zoho.com/portal/en/kb/bigin/integration/articles/integrating-with-zoho-books)) |
| Other limits | Records whose picklist value doesn't exist in Books are skipped. Fields missing in Books need custom fields created first. No numeric volume limits are published. When the integration is disabled or deleted, synced records stay in Books as standalone records. ([Bigin help](https://help.zoho.com/portal/en/kb/bigin/integration/articles/integrating-with-zoho-books), [Books help (ZA)](https://www.zoho.com/za/books/help/integrations/bigin.html)) |

### Could the app push only to Books and let Bigin update itself?

**No, at least not on the documented behaviour.**

1. Zoho documents contact sync only from Bigin into Books. Nothing documented says a customer the app creates in Books will appear in Bigin.
2. Even if a reverse sync exists, it runs every two hours or less often, and duplicate handling doesn't cover Contacts.
3. Turning on the forward sync (Bigin → Books) would make Bigin a second writer into the ledger's customer records, which breaks ADR 0005's one-way rule. Edits made in Bigin would overwrite what the app pushed to Books every two hours. A deletion in Bigin would delete the Books customer, which matters for VAT invoices to the **Payer** under ADR 0002.

---

## 4. Recommendation

**Push to Bigin directly. Don't use the built-in integration for Contacts or Companies.**

- **Fits ADR 0005.** The app writes to each target independently and one way. Nothing syncs Bigin into Books behind our backs.
- **Meets our needs.** A direct push happens within seconds rather than every two hours. Upsert on `App_Contact_ID` makes retries idempotent. Failures are reported per record so the queue can retry them.
- **Protects the ledger.** Bigin deletions and edits can't reach Books customers.
- **Cheap.** About one credit per 10 records upserted ([API limits](https://www.bigin.com/developer/docs/apis/v2/api-limits.html)) is negligible at our volume.

Operational follow-ups:

- If the Bigin ↔ Books integration is already switched on in the business's Zoho account, have the owner **pause or disable its Companies and Contacts sync** before launch. Disabling leaves existing Books records in place ([Books help (US)](https://www.zoho.com/us/books/help/integrations/bigin.html)). Deal association, which links Books invoices to Bigin pipelines, could be kept only if it works without the contact sync. Bigin stops tracking **Jobs** under ADR 0005, so it probably isn't needed.
- Push only the fields marketing needs to Bigin: name, phone, email, suburb, **Lead Channel** and **Partner**. This keeps the personal information shared with Bigin to a minimum, in line with POPIA's minimality principle. Don't send **Job** notes or addresses unless marketing needs them.

---

## 5. Rate limits and error shapes for a queued, retried push

### Bigin limits ([API limits](https://www.bigin.com/developer/docs/apis/v2/api-limits.html))

- **Credits** over a rolling 24 hours: Free 5,000. Express, Premier, Zoho One and Bigin 360 get 50,000 plus 250 per user licence, capped at 100,000.
- Insert, update and upsert cost 1 credit per 10 records, so at most 10 credits per 100-record call. Most other calls, search included, cost 1 credit.
- **Concurrency** per user per app: Free 5, paid editions 10. There are "no time-based API call restrictions", so there's no per-minute cap.
- **Sub-concurrency** is 10 combined for insert or update calls carrying more than 10 records and for some get-records calls. Over that, "the system throws an error".
- **Token endpoint:** 5 refreshes per minute per client and refresh token. Going over gives a 10-minute `access_denied` lockout ([OAuth FAQ](https://www.bigin.com/developer/docs/apis/v2/oauth-faqs.html)).

### Zoho Books limits ([Zoho Books API introduction](https://www.zoho.com/books/api/v3/introduction/))

- 100 requests a minute per organisation. Going over returns HTTP 429 with `code` 44.
- Daily: Free 1,000, Standard 2,000, Professional 5,000, Premium and above 10,000. Going over returns 429 with `code` 45.
- Concurrency: Free 5, paid 10 (a soft limit). Going over returns 429 with `code` 1070.

### Bigin error shape ([Status codes](https://www.bigin.com/developer/docs/apis/v2/status-codes.html))

Errors have the shape `{"code": "...", "details": {...}, "message": "...", "status": "error"}`. Multi-record calls return a `data[]` array with one such object for each record (`code`, `details`, `message`, `status`) ([Upsert](https://www.bigin.com/developer/docs/apis/v2/upsert-records.html), [Add records](https://bigin.com/developer/docs/apis/v2/insert-records.html)). For example, `MANDATORY_NOT_FOUND` and `INVALID_DATA` come back with HTTP **202** at record level ([Add records](https://bigin.com/developer/docs/apis/v2/insert-records.html)). **Check every `data[i].status`, not only the HTTP code.**

| HTTP / code | Meaning | Queue action |
|---|---|---|
| 200 / 201 / 202 with all `data[i].status == "success"` | Done | Ack and store `details.id` |
| 202 with some `data[i].status == "error"` | Partial success | Ack the successes. Send failed records to the dead-letter queue with their `code`/`details`; don't blindly retry. |
| 400 `INVALID_DATA`, `MANDATORY_NOT_FOUND`, `INVALID_FIELD`, `INVALID_MODULE` | Bad payload or mapping | Don't retry. Dead-letter and alert. |
| `DUPLICATE_DATA` | A unique field clashes, for example `App_Contact_ID` already exists | Shouldn't happen with upsert. Re-run as upsert, or look up the record and update it. |
| 401 (invalid token) / `OAUTH_SCOPE_MISMATCH` | Token expired or wrong scope | Refresh once (respecting the 5-a-minute limit) and retry. On a scope mismatch, alert. |
| 403 `NO_PERMISSION` / `AUTHORIZATION_FAILED` | Missing permission, or the trial has expired | Don't retry. Alert. |
| 429 | 24-hour credits or the per-user concurrency limit exceeded | Back off with jitter. If credits are exhausted, delay by hours, because the window is a rolling 24 hours. |
| 500 `INTERNAL_ERROR` | Server error | Retry with exponential backoff |
| Token endpoint `access_denied` | Refresh limit exceeded | Pause all pushes for 10 minutes or more |

The docs don't mention a `Retry-After` header ([API limits](https://www.bigin.com/developer/docs/apis/v2/api-limits.html), [Status codes](https://www.bigin.com/developer/docs/apis/v2/status-codes.html)), so use our own backoff schedule. Keep Bigin calls at 10 or fewer in flight, which suits a Cloudflare Queue consumer with `max_concurrency` of about 5. Batch up to 100 records per upsert when draining a backlog.

---

## Open questions to verify against the live account

1. Which DC the business's Zoho account is on (`.com` or `.eu` are likely; **not** `.sa`).
2. Whether one refresh token can carry both `ZohoBigin.*` and `ZohoBooks.*` scopes. Test it with a server-based client.
3. Whether the Bigin ↔ Books integration is already enabled, and with which views.
4. The Bigin edition (it sets the credit limits) and whether it allows a unique custom field (`App_Contact_ID`).
