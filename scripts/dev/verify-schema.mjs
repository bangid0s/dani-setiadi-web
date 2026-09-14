import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres("postgresql://postgres@127.0.0.1:5555/postgres", {
  prepare: false, max: 1, idle_timeout: 5,
});

const dir = path.join(process.cwd(), "supabase", "migrations");
const text = fs.readFileSync(path.join(dir, "0001_init.sql"), "utf8");
try {
  await sql.unsafe(text);
  console.log("✓ 0001_init.sql applied cleanly");
} catch (e) {
  console.error("✗ 0001_init.sql failed:\n ", e.message);
  process.exit(1);
}

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name`;
console.log("  tables:", tables.map((t) => t.table_name).join(", "));

const policies = await sql`select count(*)::int as n from pg_policies where schemaname='public'`;
console.log("  RLS policies:", policies[0].n);

const rls = await sql`
  select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`;
console.log("  tables WITHOUT RLS:", rls.length ? rls.map(r=>r.relname).join(", ") : "none");

await sql.end();
