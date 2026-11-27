# Happy Home Field Service

The job-management app for Happy Home Appliance Repairs (Pty) Ltd, a SMEG-authorised domestic appliance repair business in Cape Town. It tracks repair work from booking to completion, gets technicians to customers, and keeps customers, payers and partners informed.

## Language

### Work

**Job**:
One repair of one appliance for one **Customer**, from booking until it is completed and handed to the ledger for invoicing. Every **Job** is either a **Warranty Job** or a **Private Job**.
_Avoid_: Ticket, work order, case

**Warranty Job**:
A **Job** covered by the manufacturer's warranty (SMEG), so the manufacturer rather than the **Customer** carries the repair cost.
_Avoid_: Guarantee job, in-warranty

**Private Job**:
A **Job** not covered by warranty, paid for by its **Payer**.
_Avoid_: Out-of-warranty job, COD job, cash job

**Visit**:
A single trip by a **Technician** to the **Customer** as part of a **Job**. A **Job** has one or more **Visits** (e.g. diagnosis, then a return visit to fit parts).
_Avoid_: Call-out, appointment, booking

### People and organisations

**Customer**:
The person at the address where the appliance is, who we deal with on site. Often the owner, but may be a tenant.
_Avoid_: Client, end user, occupant

**Payer**:
The person or organisation invoiced for a **Job**. Defaults to the **Customer**, but may be a property owner or a managing agent when the **Customer** is a tenant.
_Avoid_: Bill-to, account holder, debtor

**Partner**:
An organisation that sent us the lead for a **Job** (e.g. SMEG, Hirsch's). A **Job** has at most one **Partner**, and it is a separate role from **Payer**.
_Avoid_: Referrer, lead source, dealer

**Technician**:
A Happy Home employee who carries out **Visits**.
_Avoid_: Tech, engineer, field agent

**Office**:
The Happy Home staff (owner and admin) who create **Jobs**, schedule **Visits**, and manage **Partners** from a desktop.
_Avoid_: Dispatcher, back office

### Communication

**Partner Update**:
A progress message about a **Job** sent to its **Partner**. Drafted by the app when the **Job** changes status, and always reviewed and sent by the **Office**.
_Avoid_: Partner notification, status report
