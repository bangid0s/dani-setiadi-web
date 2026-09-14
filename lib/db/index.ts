import "server-only";
import postgres from "postgres";

/**
 * One Postgres pool per process.
 *
 * On Vercel every serverless invocation may be a fresh process, so the pool is
 * kept tiny and cached on globalThis to survive dev hot-reloads. Use Supabase's
 * **transaction pooler** connection string (port 6543): it is the one built for
 * serverless, and it does not support prepared statements, hence `prepare:false`.
 */
declare global {
  var __daniSql: postgres.Sql | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your " +
        "Supabase connection string (Project settings → Database → Connection " +
        "string → Transaction pooler).",
    );
  }
  return url;
}

function create(): postgres.Sql {
  return postgres(connectionString(), {
    // Supavisor's transaction mode cannot cache prepared statements.
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idle_timeout: 20,
    connect_timeout: 15,
    // Dates come back as ISO strings so the repository layer stays unchanged.
    types: {
      date: {
        to: 1184,
        from: [1082, 1114, 1184],
        serialize: (v: Date | string) => (v instanceof Date ? v.toISOString() : v),
        parse: (v: string) => v,
      },
    },
    onnotice: () => {},
  });
}

export const sql: postgres.Sql = globalThis.__daniSql ?? (globalThis.__daniSql = create());

export const nowIso = () => new Date().toISOString();

/** JSONB columns arrive parsed; this keeps callers safe either way. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const toBool = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "t";
