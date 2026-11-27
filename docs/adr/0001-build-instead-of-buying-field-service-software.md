# Build our own field service app instead of buying one

Off-the-shelf field service tools (Jobber, ServiceM8, Fergus and similar) cover most of what we need, but they charge per user per month in foreign currency, which becomes expensive as the technician team grows. We are building our own so the running cost is mostly hosting and messaging, and so we can shape it around things those tools don't do well for us: automated "on my way" WhatsApp/SMS messages, technician location, status updates to partners (SMEG, Hirsch's and others), and a faster, simpler interface for technicians.

## Consequences

We own maintenance, uptime, security and POPIA compliance ourselves. Scope has to stay narrow: generic features (customers, scheduling) stay deliberately plain, and effort goes to the differentiators above.
