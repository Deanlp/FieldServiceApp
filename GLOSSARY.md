# Happy Home Field Service

The job-management app for Happy Home Appliance Repairs (Pty) Ltd, a SMEG-authorised domestic appliance repair business in Cape Town. It tracks repair work from booking to completion, gets technicians to customers, and keeps customers and partners informed.

## Language

### Work

**Job**:
One repair of one appliance for one **Customer**, from booking until it is completed and handed to the ledger for invoicing.
_Avoid_: Ticket, work order, case

**Visit**:
A single trip by a **Technician** to the **Customer** as part of a **Job**. A **Job** has one or more **Visits** (e.g. diagnosis, then a return visit to fit parts).
_Avoid_: Call-out, appointment, booking

### People

**Customer**:
The person or household whose appliance is being repaired and at whose address **Visits** take place.
_Avoid_: Client, end user

**Technician**:
A Happy Home employee who carries out **Visits**.
_Avoid_: Tech, engineer, field agent

**Office**:
The Happy Home staff (owner and admin) who create **Jobs**, schedule **Visits**, and manage partners from a desktop.
_Avoid_: Dispatcher, back office
