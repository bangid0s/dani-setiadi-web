/**
 * Shared helpers for the command-line scripts: loads .env.local, opens a
 * Postgres connection, and applies the SQL migrations.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  }
}

export function connect() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set.\n" +
        "  Copy .env.example to .env.local and paste your Supabase connection\n" +
        "  string (Project settings → Database → Connection string → Transaction pooler).",
    );
    process.exit(1);
  }
  return postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 20 });
}

export async function migrate(sql) {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    try {
      await sql.unsafe(text);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      // The storage migration needs privileges the pooler role may not hold.
      if (file.includes("storage")) {
        console.log(`  ! ${file} — ${err.message.split("\n")[0]}`);
        console.log("    Run this one in the Supabase SQL editor instead.");
      } else {
        throw err;
      }
    }
  }
}
