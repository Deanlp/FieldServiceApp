# Installable web app on Cloudflare, in TypeScript

The app is a single TypeScript web app, installable to a phone's home screen (no app store), hosted on Cloudflare: Workers for the server, D1 for the database, R2 for photos. Sign-in is by emailed one-time code. With one admin and two **Technicians**, this keeps running costs close to zero and reuses the Cloudflare account that already hosts the website.

## Considered Options

- Native mobile app (e.g. Expo/React Native): rejected for v1. It is only needed for continuous background location, and v1 records location only when a **Technician** taps a status.
- A conventional server and Postgres database: rejected as more to run and pay for, with no benefit at this size.

## Consequences

D1 is SQLite-based, so heavy reporting or very large datasets may eventually need a different store. Continuous technician tracking would require adding a native app.
