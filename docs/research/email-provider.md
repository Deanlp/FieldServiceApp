# R4 · Transactional email provider

Research ticket R4: which service the app should use to send (a) sign-in one-time codes to **Office** staff and **Technicians** (ADR 0004: "Sign-in is by emailed one-time code") and (b) **Partner Updates**, from the business's own domain, without breaking the mailboxes that already work on that domain.

Researched 2026-11-28 against the providers' own documentation and pricing pages only. Nothing was tested against a live account, and no business details were sent to any provider. Points marked **[verify]** need checking in a real account or DNS zone before we rely on them. Prices are in US dollars as published. Rand figures are rough, at an assumed R18 to the dollar. That rate is an assumption and is not taken from any source.

Volume assumption: under 1,000 emails a month. Three staff signing in about once a working day comes to roughly 70 codes a month. **Partner Updates** make up the rest.

## Sources

Every claim below is tagged with one of these source keys.

| Key | Source |
|---|---|
| CF-ES | https://developers.cloudflare.com/email-service/ |
| CF-PRICE | https://developers.cloudflare.com/email-service/platform/pricing/ |
| CF-LIMITS | https://developers.cloudflare.com/email-service/platform/limits/ |
| CF-START | https://developers.cloudflare.com/email-service/get-started/send-emails/ |
| CF-BIND | https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/ |
| CF-DELIV | https://developers.cloudflare.com/email-service/concepts/deliverability/ |
| CF-BETA | https://developers.cloudflare.com/changelog/post/2026-04-16-email-sending-public-beta/ |
| CF-ROUTE | https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/ |
| CF-WPRICE | https://developers.cloudflare.com/workers/platform/pricing/ |
| CF-NS | https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/ |
| RS-PRICE | https://resend.com/pricing |
| RS-DOM | https://resend.com/docs/dashboard/domains/introduction |
| RS-ADD | https://resend.com/docs/add-a-domain |
| RS-CF | https://resend.com/docs/knowledge-base/cloudflare |
| RS-WORKER | https://resend.com/docs/send-with-cloudflare-workers |
| RS-API | https://resend.com/docs/api-reference/emails/send-email |
| PM-PRICE | https://postmarkapp.com/pricing |
| PM-HOME | https://postmarkapp.com/ |
| PM-VERIFY | https://postmarkapp.com/support/article/how-do-i-verify-a-domain |
| PM-SPF | https://postmarkapp.com/blog/why-we-no-longer-ask-for-spf-records |
| PM-APPROVE | https://postmarkapp.com/support/article/1084-how-does-the-account-approval-process-work |
| PM-API | https://postmarkapp.com/developer/api/email-api |
| SES-PRICE | https://aws.amazon.com/ses/pricing/ |
| SES-SANDBOX | https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html |
| SES-EP | https://docs.aws.amazon.com/general/latest/gr/ses.html |
| SES-MAILFROM | https://docs.aws.amazon.com/ses/latest/dg/mail-from.html |
| SES-API | https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html |
| ZC-PRICE | https://www.zoho.com/cpaas/pricing.html (the old https://www.zoho.com/zeptomail/pricing.html redirects here). The amounts on the page load from https://www.zohowebstatic.com/sites/zweb/json/pricing/cpaas-pricing-val.json, which is where the figures below were read. |
| ZC-DNS | https://www.zoho.com/zeptomail/help/domains.html |
| ZC-API | https://www.zoho.com/zeptomail/help/api/email-sending.html |
| ZC-REVIEW | https://help.zoho.com/portal/en/kb/zoho-cpaas/faqs/getting-started/articles/can-i-immediately-start-sending-out-emails-once-i-create-my-account |
| G-SPF | https://knowledge.workspace.google.com/admin/security/set-up-spf |
| G-DMARC | https://knowledge.workspace.google.com/admin/security/set-up-dmarc |
| G-MX | https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace |
| G-SENDER | https://support.google.com/a/answer/81126 (Gmail sender guidelines) |
| Z-SPF | https://www.zoho.com/mail/help/adminconsole/spf-configuration.html |
| Z-MX | https://www.zoho.com/mail/help/adminconsole/configure-email-delivery.html |
| RFC7208 | https://www.rfc-editor.org/rfc/rfc7208 (SPF standard, sections 4.5 and 4.6.4) |

## Summary

**Recommendation: Resend.** At our volume it costs nothing: the free plan allows 3,000 emails a month, capped at 100 a day [RS-PRICE]. It is a plain HTTPS API with a documented Cloudflare Workers guide [RS-WORKER]. It supports BCC and Reply-To [RS-API]. Its SPF and bounce records go on a `send.` subdomain, so the existing mailbox SPF record is not touched [RS-CF].

**Runner-up: Cloudflare Email Service.** It is the most natural fit for our stack, with a native Worker binding and no API key [CF-BETA]. Two things count against it today. Sending is still labelled Beta [CF-ES], and sign-in codes depend on it. Sending to anyone other than our own verified addresses also needs the Workers Paid plan, at a minimum of $5 a month [CF-PRICE][CF-WPRICE]. Keep the app's email code behind one small interface so we can move to Cloudflare once sending is out of beta.

**Third choice: Zoho ZeptoMail, now sold as Zoho CPaaS.** It costs very little and keeps us with a vendor we already use. The drawback is a manual account review, which Zoho says generally takes 2 business days [ZC-REVIEW].

Postmark has the strongest deliverability story but costs $15 a month for 10,000 emails, with no tier between the free 100 emails and that [PM-PRICE]. Amazon SES is the cheapest per email and has a Cape Town region [SES-PRICE][SES-EP]. It also comes with a sandbox to get out of [SES-SANDBOX], request signing and the most AWS admin. Neither is worth it at our size.

## Comparison

| | Cloudflare Email Service | Resend | Postmark | Amazon SES | Zoho ZeptoMail / CPaaS |
|---|---|---|---|---|---|
| **Cost at < 1,000/month** | $0 extra if the account is already on Workers Paid (3,000/month included, then $0.35 per 1,000) [CF-PRICE]. Otherwise Workers Paid costs at least $5/month (≈ R90) [CF-WPRICE]. | $0 on the free plan [RS-PRICE] | $15/month (≈ R270) for the Basic plan (10,000/month) [PM-PRICE] | ≈ $0.10/month at $0.10 per 1,000 à la carte, plus $0.12/GB of attachments [SES-PRICE] | R37.50 per credit of 10,000 emails, valid for 6 months [ZC-PRICE]. At our volume that is one credit every 6 months, roughly R6 a month. |
| **Free tier** | Workers Free plan: sends only to verified destination addresses [CF-PRICE] | 3,000/month, 100/day [RS-PRICE] | 100/month, no overage allowed [PM-PRICE] | New AWS customers get up to $200 in Free Tier credits [SES-PRICE] | First credit (10,000 emails) free [ZC-PRICE]. Before review, sending is limited and further credits can't be bought [ZC-REVIEW]. |
| **Maturity / deliverability** | Sending is labelled Beta [CF-ES]. Cloudflare manages IP reputation [CF-DELIV]. New accounts start on a "conservative daily quota" with no number given [CF-LIMITS]. | Generally available. Runs on Amazon SES infrastructure, as its SPF record `include:amazonses.com` shows [RS-CF]. No dedicated IP below the Scale plan [RS-PRICE]. | Manually vets every new account [PM-APPROVE]. Promotional mail goes through "parallel but separate sending infrastructure" [PM-HOME]. This is the strongest transactional-only position, but it is the vendor's own claim. | Starts in a sandbox: verified recipients only, 200 messages a day, 1 a second. AWS responds to a production-access request within 96 hours [SES-SANDBOX]. | Transactional mail only. Account review is required before full sending [ZC-REVIEW]. |
| **Use from a Worker** | Native `send_email` binding, `env.EMAIL.send({...})`, no API key [CF-START][CF-BIND] | `fetch` POST to `api.resend.com/emails` with a Bearer key, or the `resend` SDK. There is an official Workers guide [RS-WORKER][RS-API]. | `fetch` POST to `api.postmarkapp.com/email` with the `X-Postmark-Server-Token` header [PM-API] | `POST /v2/email/outbound-emails` [SES-API]. Requests must be AWS SigV4-signed, so we would need a signing library. | `fetch` POST to `cpaas.zoho.com/v1.1/email` with `Authorization: Zoho-enczapikey …` [ZC-API] |
| **BCC / Reply-To** | `bcc`, `replyTo` [CF-BIND] | `bcc`, `reply_to` [RS-API] | `Bcc`, `ReplyTo` [PM-API] | `Destination.BccAddresses`, `ReplyToAddresses` [SES-API] | `bcc`, `reply_to` [ZC-API] |
| **DNS records** | MX, SPF and DKIM on the `cf-bounce` subdomain, plus DMARC on `_dmarc` [CF-START] | MX and SPF TXT on `send`, DKIM TXT on `resend._domainkey` [RS-CF] | DKIM TXT, plus a Return-Path CNAME `pm_bounces` → `pm.mtasv.net` [PM-VERIFY] | Easy DKIM records. An optional custom MAIL FROM adds MX and SPF TXT on a subdomain [SES-MAILFROM]. | DKIM TXT `<selector>._domainkey…`, plus a bounce CNAME. "An SPF record is not required." [ZC-DNS] |
| **Root SPF change needed?** | No, SPF sits on `cf-bounce` [CF-START] | No, SPF sits on `send` [RS-CF] | No [PM-SPF] | No, SPF sits on the MAIL FROM subdomain [SES-MAILFROM] | No [ZC-DNS] |
| **Other requirements** | The domain must use Cloudflare DNS [CF-START] | None | Account approval before mail can go outside our own domain [PM-APPROVE] | Production access request [SES-SANDBOX] | Account review, about 2 business days [ZC-REVIEW] |

### Notes per provider

**Cloudflare Email Service.** This is what Cloudflare now calls the product. "Email Sending" handles outbound mail and "Email Routing" handles inbound [CF-ES]. Sending reached public beta on 2026-04-16 [CF-BETA]. It can send through the Workers binding, a REST API or SMTP [CF-ES].

On the Workers Free plan it delivers only to verified destination addresses in our account [CF-ES][CF-PRICE]. That would cover the three staff sign-in codes once each address is verified, but no **Partner** could ever receive an update. On Workers Paid it can send to any recipient, with 3,000 emails a month included [CF-PRICE][CF-LIMITS]. Each message can have at most 50 recipients across to, cc and bcc [CF-LIMITS].

Do **not** turn on *Email Routing* for the root domain. Its setup adds MX records at the root to route incoming mail to Cloudflare [CF-ROUTE], which would take mail away from the existing mailboxes. Sending alone does not need it.

**Resend.** Resend recommends sending from a subdomain [RS-DOM]. The return path defaults to `send.<domain>` [RS-ADD]. Records must match exactly what Resend generates, and the DKIM record must be set to "DNS only" in Cloudflare [RS-ADD][RS-CF]. The free plan's 100-a-day cap is the one limit to watch. A busy day of **Partner Updates** plus sign-in codes would need to exceed 100 before it mattered, and the Pro plan at $20 a month removes the cap [RS-PRICE].

**Postmark.** While an account is pending approval, it can only send to the domains it has verified [PM-APPROVE]. It is excellent but overpriced for 1,000 emails, because nothing sits between the free 100 and the paid 10,000 [PM-PRICE].

**Amazon SES.** A Cape Town (`af-south-1`) API endpoint exists [SES-EP], which helps if we want the data to stay in South Africa (see POPIA below). SMTP is not available in Cape Town [SES-EP], but we would use the HTTPS API anyway. Sandbox limits apply per region until AWS grants production access [SES-SANDBOX].

**Zoho ZeptoMail / Zoho CPaaS.** ZeptoMail's pricing page now redirects to Zoho CPaaS, which sells credits for email, SMS, WhatsApp and voice. Each email credit covers 10,000 emails and lasts 6 months [ZC-PRICE]. The price file also holds a second, lower set of email-credit prices (for example $2 instead of $2.50) that the page did not show **[verify]**. Zoho says sending can start right after account creation and domain verification. To keep sending and buy more credits, the account must pass a customer-validation review, which "generally" takes 2 business days [ZC-REVIEW]. The send API lives at `cpaas.zoho.com` [ZC-API]. Zoho Books gives us an existing relationship but no technical shortcut, because CPaaS uses its own API key.

### POPIA note

Codes and **Partner Updates** carry staff and **Customer** personal information. With every provider here except SES in `af-south-1` [SES-EP], that information leaves South Africa, so the cross-border transfer rules in section 72 of POPIA apply. Keep **Partner Update** emails to the minimum needed: the **Partner Reference**, the status and the next step. Accept the provider's data processing terms when the account is opened. This is a pointer, not legal advice. This ticket did not review any provider's data processing agreement **[verify]**.

## Can sent Partner Updates also land in the office mailbox?

Yes, and every provider supports both mechanisms (see the BCC / Reply-To row above).

1. **Reply-To = the office address.** Every **Partner** reply then goes straight to the office mailbox, whatever the From address is. All five APIs take a Reply-To field [CF-BIND][RS-API][PM-API][SES-API][ZC-API]. This is the important one, because it means partner replies are never lost.
2. **BCC the office address.** The office mailbox gets a copy of exactly what was sent, which acts as the "sent" record. Every API takes a BCC field (same sources). The **Partner** does not see BCC recipients.

Suggested headers for a **Partner Update**:

```
From:     Happy Home Appliance Repairs <office@<domain>>
Reply-To: office@<domain>
To:       <partner contact>
Bcc:      office@<domain>
```

Sign-in codes should come from a separate address such as `no-reply@<domain>`, with no BCC.

Two cautions:

- The office's copy arrives as *incoming* mail "from" the office's own address. It passes authentication because the provider signs with our DKIM key (see the DNS steps). Still, send a test first and check it is not flagged or filed as spam **[verify]**. A Gmail filter on the BCC copy (for example, label it "Partner Updates") keeps the inbox tidy.
- The copy will not appear in the office mailbox's **Sent** folder. Getting it there would mean sending through the mailbox provider's own API, which this ticket did not cover.

## How the DNS fits with existing mailboxes

These rules apply whichever provider is chosen:

- **A domain can have only one SPF record.** If a lookup finds more than one, the result is "permerror", meaning SPF fails for *all* mail [RFC7208 §4.5]. Zoho gives the same advice: "Publish only one SPF TXT record per domain", and combine every sender into that record [Z-SPF]. Google says to add an `include:` for each sender to the existing record rather than create a second one [G-SPF].
- **SPF evaluation is limited to 10 DNS lookups** [RFC7208 §4.6.4]. Google words this as at most 10 `include:` tags [G-SPF].
- **Most providers above do not touch the root SPF record at all.** Resend, Cloudflare and SES put their SPF on a bounce subdomain [RS-CF][CF-START][SES-MAILFROM], and Postmark and Zoho need no SPF from us [PM-SPF][ZC-DNS]. The SPF that matters to the recipient's DMARC check is the one on that subdomain. Our mail authenticates for DMARC through DKIM, which aligns with the From domain [G-DMARC]. So the existing root record, such as Google's `v=spf1 include:_spf.google.com ~all` [G-SPF], stays exactly as it is. Merge an `include:` into it only if a provider explicitly asks for one at the root. If so, edit the existing record; never add a second one.
- **DMARC: also only one record, at `_dmarc.<domain>`** [G-DMARC]. If one already exists, keep it. Cloudflare's onboarding offers to add a DMARC record [CF-START], and you should not let it create a second one **[verify]**. If none exists, start with `p=none` and a report address, then tighten to `quarantine` or `reject` once the reports are clean. Enable DMARC at least 48 hours after SPF and DKIM are in place [G-DMARC].
- **Never change the root MX records.** They are what deliver the existing mailboxes' mail [G-MX]. Provider MX records go only on their bounce subdomain (`send`, `cf-bounce`, or the SES MAIL FROM subdomain) [RS-CF][CF-START][SES-MAILFROM].
- Gmail requires every sender to have SPF *or* DKIM. The full SPF, DKIM, DMARC and alignment set is mandatory only above 5,000 messages a day [G-SENDER], well beyond our volume. We will set all three up anyway.

## Owner's manual DNS steps (Resend)

Before you start, find out where the domain's DNS is hosted and who handles its mail. Make all changes at the DNS host, because records added anywhere else are ignored [Z-SPF].

1. **Find the DNS host.** Run `dig NS <domain> +short` in a terminal, or use Google's Admin Toolbox Dig tool. If the answers end in `ns.cloudflare.com`, Cloudflare hosts the DNS and you edit records in the Cloudflare dashboard under **DNS → Records** [CF-NS]. Otherwise, edit them wherever those nameservers belong, usually the domain registrar.
2. **Find the mailbox provider.** Run `dig MX <domain> +short`.
   - `smtp.google.com`, or hosts starting with `aspmx`, mean **Google Workspace** [G-MX].
   - `mx.zoho.com`, `mx2.zoho.com` and `mx3.zoho.com` (the ending can vary by Zoho data centre) mean **Zoho Mail** [Z-MX].
   - Anything else: tell the developer before going further.

   Write down the MX values. You will not change them.
3. **Take a snapshot.** Screenshot or export every existing DNS record, especially the root `TXT` record starting with `v=spf1` and any `TXT` record on `_dmarc`. If you find **two** `v=spf1` records on the root, fix that first by merging them into one [RFC7208 §4.5][Z-SPF].
4. **Create the Resend account and add the domain.** In the Resend dashboard, add the domain. Open its **Records** tab and keep it open; the values there are unique to us [RS-ADD].
5. **Add the bounce MX record.** Type `MX`, name `send`, mail server as shown in Resend (it looks like `feedback-smtp.<region>.amazonaws.com`), priority `10` [RS-CF]. This sits on `send.<domain>` only, so it does not affect the mailboxes.
6. **Add the bounce SPF record.** Type `TXT`, name `send`, value `v=spf1 include:amazonses.com ~all` [RS-CF]. This is a *separate* host from the root, so it does not count as a second SPF record. **Do not edit the root SPF record.**
7. **Add the DKIM record.** Type `TXT`, name `resend._domainkey`, content copied exactly from Resend. If the DNS is on Cloudflare, set the proxy status to **DNS only** [RS-CF].
8. **Verify in Resend.** Click **Verify** and wait until the domain shows as verified. DNS changes can take a while to propagate.
9. **Set up DMARC.**
   - If `_dmarc.<domain>` already has a record, leave it alone and skip to step 10.
   - If it has none, add one: type `TXT`, name `_dmarc`, value `v=DMARC1; p=none; rua=mailto:<office address>` [G-DMARC]. Do this at least 48 hours after steps 5 to 8, and after confirming that the mailbox provider's own DKIM is switched on [G-DMARC]. For Google Workspace, that is under **Admin console → Apps → Google Workspace → Gmail → Authenticate email** **[verify]**.
10. **Send test emails.** Have the developer send one test to a Gmail address and one to the office address. In each, open **Show original** and check that SPF, DKIM and DMARC all say PASS. Then check that normal office email still sends and arrives.
11. **Tighten DMARC later (optional).** After a few weeks of clean reports, change `p=none` to `p=quarantine` [G-DMARC].

If the business later moves to Cloudflare Email Service instead, steps 5 to 8 are replaced by Cloudflare's onboarding. It adds MX, SPF and DKIM on `cf-bounce` and offers a DMARC record [CF-START]. Skip the DMARC record if one already exists. That route requires the DNS to be on Cloudflare (step 1) [CF-START], and **Email Routing** must stay off for the root domain [CF-ROUTE].

## Open points

- **[verify]** Whether the Cloudflare account is already on Workers Paid. If it is, Cloudflare Email Service costs nothing extra, and the case for it gets stronger once it leaves beta.
- **[verify]** Whether the domain's DNS is on Cloudflare. ADR 0004 says the website is already hosted on the same Cloudflare account, which suggests it is, but the `dig NS` check in step 1 settles it.
- **[verify]** Read Resend's data processing terms for POPIA purposes before going live.
