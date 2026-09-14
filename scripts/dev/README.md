# Dev-only helpers

These are not used in production and are not needed to deploy.

## A throwaway Postgres, with no Supabase project

`pg-test-server.mjs` runs PGlite — Postgres compiled to WebAssembly — behind the
real Postgres wire protocol, so the app and the `postgres` driver talk to it
exactly as they would to Supabase.

```bash
node scripts/dev/pg-test-server.mjs        # listens on 127.0.0.1:5555
```

Then point `.env.local` at it:

```
DATABASE_URL=postgresql://postgres@127.0.0.1:5555/postgres
DB_POOL_MAX=1
```

`DB_POOL_MAX=1` matters: PGlite's socket server accepts one connection at a
time. Real Supabase does not need it.

The database is in memory, so it disappears when you stop the server. Run
`npm run db:setup` after starting it to create the schema and seed content.

## Checking a migration

```bash
node scripts/dev/verify-schema.mjs
```

Applies `supabase/migrations/0001_init.sql` to the running test server and
prints the tables, the RLS policy count, and any table left without RLS.
