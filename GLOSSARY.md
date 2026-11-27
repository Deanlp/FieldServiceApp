# Happy Home Field Service

The job-management app for Happy Home Appliance Repairs (Pty) Ltd, a SMEG-authorised domestic appliance repair business in Cape Town. It tracks repair work from booking to completion, gets technicians to customers, and keeps customers, payers and partners informed.

## Language

### Work

**Job**:
One repair of one appliance for one **Customer**, from booking until it is completed and handed to the ledger for invoicing or claiming. Every **Job** is either a **Warranty Job** or a **Private Job**.
_Avoid_: Ticket, work order, case

**Warranty Job**:
A **Job** covered by SMEG's manufacturer warranty, paid by SMEG through the monthly **Warranty Claim** rather than by invoice.
_Avoid_: Guarantee job, in-warranty

**Private Job**:
A **Job** not covered by SMEG warranty, invoiced to its **Payer**.
_Avoid_: Out-of-warranty job, COD job, cash job

**Visit**:
A single trip by a **Technician** to the **Customer** as part of a **Job**. A **Job** has one or more **Visits** (e.g. diagnosis, then a return visit to fit parts).
_Avoid_: Call-out, appointment, booking

**Quote**:
The priced proposal for a **Private Job**, which the **Payer** must approve before parts are ordered. Held in the ledger as an estimate.
_Avoid_: Estimate, proposal

### People and organisations

**Contact**:
Any person or organisation the business deals with. A **Contact** can play the role of **Customer**, **Payer** or **Partner** on a **Job**.
_Avoid_: Client, account

**Customer**:
The person at the address where the appliance is, who we deal with on site. Often the owner, but may be a tenant.
_Avoid_: Client, end user, occupant

**Payer**:
The **Contact** invoiced for a **Private Job**. Defaults to the **Customer**, but may be a property owner, a managing agent, or the **Job's** own **Partner**.
_Avoid_: Bill-to, account holder, debtor

**Partner**:
An organisation that sent us the lead for a **Job** (e.g. SMEG, Hirsch's, Azoza). A **Job** has at most one **Partner**, and it is a separate role from **Payer**, though the same organisation may fill both.
_Avoid_: Referrer, dealer

**Technician**:
A Happy Home employee who carries out **Visits**.
_Avoid_: Tech, engineer, field agent

**Office**:
The Happy Home staff (owner and admin) who create **Jobs**, schedule **Visits**, and manage **Partners** from a desktop.
_Avoid_: Dispatcher, back office

### Leads and references

**Lead Channel**:
How the lead for a **Job** reached us: Partner, Website, Google, Repeat, Word of mouth or Other. When it is Partner, the **Job** names its **Partner**.
_Avoid_: Lead source, referral type

**Payer Reference**:
The **Payer's** own number for the **Job** (work order or PO number), quoted on the invoice. Required before invoicing when the **Payer** is an organisation.
_Avoid_: PO, order number

**Partner Reference**:
The **Partner's** own number for the **Job** (e.g. a Hirsch's ticket or SMEG intervention number), quoted in **Partner Updates**.
_Avoid_: Partner ticket, external ID

### Money

**Warranty Claim**:
The monthly cover sheet sent to SMEG listing the completed, payable **Warranty Jobs** in a **Claim Period**.
_Avoid_: SMEG invoice, claim form, coversheet

**Claim Period**:
The window a **Warranty Claim** covers: the 6th of the previous month to the 5th of the current month.
_Avoid_: Claim month, billing cycle

### Communication

**Partner Update**:
A progress message about a **Job** sent to its **Partner**. Drafted by the app when the **Job** changes status, and always reviewed and sent by the **Office**.
_Avoid_: Partner notification, status report
