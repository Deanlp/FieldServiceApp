# Happy Home Field Service

Job-management app for Happy Home Appliance Repairs (Pty) Ltd. See `GLOSSARY.md` for the domain language, `docs/adr/` for architecture decisions, and the v1 spec in GitHub issue #1.

It is a TypeScript web app, installable to a phone's home screen, running on Cloudflare: Workers (API), D1 (database) and R2 (photos). See ADR 0004.

## Layout

- `src/worker/`: the API (Hono on a Cloudflare Worker). `app.ts` builds the API from a set of adapters; `index.ts` is the deployed entry point.
- `src/worker/adapters/`: interfaces for outside systems (Zoho Books, Bigin, email, maps). Production uses real adapters as each integration ticket lands.
- `src/web/`: the installable web app (React, built by Vite into `dist/`, served by the Worker).
- `migrations/`: D1 database migrations, applied in order.
- `test/server/`: **Seam 1** tests. Real requests against the API, running in the Workers runtime with a real local D1 database. Outside systems are recording fakes (`test/support/fakes.ts`).
- `test/modules/`: **Seam 2** tests. Pure domain modules such as the Warranty Claim builder, run in plain Node.

## Run locally

```bash
npm install
npm run dev
```

This builds the web app, applies migrations to a local database, and serves everything at http://localhost:8787.

## Test

```bash
npm run typecheck
npm test
```

CI runs typecheck, tests and build on every push.

## Deploy (first time)

1. Log in: `npx wrangler login`
2. Create the database: `npx wrangler d1 create happyhome-field`, then put the printed `database_id` into `wrangler.jsonc`.
3. Create the photo bucket: `npx wrangler r2 bucket create happyhome-field-photos`
4. Deploy: `npm run deploy` (builds, applies migrations to the remote database, deploys the Worker).

After that, `npm run deploy` is all that is needed.
