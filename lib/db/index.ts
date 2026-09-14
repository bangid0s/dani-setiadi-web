import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * Single SQLite handle for the process. In dev, Next's HMR re-evaluates modules,
 * so the handle is cached on globalThis to avoid leaking connections.
 */
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "content.db");

declare global {
  var __daniDb: Database.Database | undefined;
}

function create(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "schema.sql"),
    "utf8",
  );
  database.exec(schema);
  return database;
}

export const db: Database.Database = globalThis.__daniDb ?? (globalThis.__daniDb = create());

export const nowIso = () => new Date().toISOString();

/** JSON column helper — never throws on malformed stored JSON. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const toBool = (v: unknown): boolean => v === 1 || v === true || v === "1";
export const fromBool = (v: boolean | undefined): number => (v ? 1 : 0);
