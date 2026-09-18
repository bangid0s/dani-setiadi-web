import "server-only";
import postgres from "postgres";

/**
 * Postgres connection for the whole app.
 *
 * Use Supabase's **transaction pooler** — the pooler host on port **6543**.
 *
 * We automatically upgrade connections mapped to the session pooler (5432) to 6543
 * to prevent connection exhaustion on Vercel Serverless.
 * Supavisor now supports interleaved query pipelining with `prepare: false`.
 *
 * The pool is deliberately small and gives idle connections back quickly:
 * transaction mode holds a server-side connection for only the duration of a query,
 * allowing hundreds of Serverless functions to safely share a small backend pool.
 */
declare global {
  var __daniSql: postgres.Sql | undefined;
}

const TRANSACTION_POOLER_PORT = "6543";

function connectionString(): string {
  let url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your " +
        "Supabase connection string (Project settings → Database → Connection " +
        "string → Session pooler).",
    );
  }
  // Automatically upgrade to Supabase Transaction Pooler (port 6543)
  // This is required for Vercel Serverless to prevent connection exhaustion.
  // Supavisor now supports pipelined queries safely with prepare: false.
  if (url.includes("pooler.supabase.com") && url.includes(":5432/")) {
    url = url.replace(":5432/", ":6543/");
  }
  
  return url;
}

function create(): postgres.Sql {
  const url = connectionString();

  const defaultMax = process.env.NODE_ENV === "production" ? 2 : 10;

  return postgres(url, {
    // Supabase requires SSL for external connections
    ssl: "require",
    // Prepared statements are disabled to ensure full compatibility with Supabase poolers
    // and avoid collision issues across connection re-use.
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? defaultMax),
    idle_timeout: Number(process.env.DB_IDLE_TIMEOUT ?? 2),
    max_lifetime: 10,
    connect_timeout: 10,
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
    ...(process.env.DB_TRACE
      ? {
          debug: (_conn: number, query: string) =>
            console.error("[db] query:", query.slice(0, 90)),
        }
      : {}),
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
