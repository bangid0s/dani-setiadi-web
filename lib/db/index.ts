import "server-only";
import postgres from "postgres";

/**
 * Postgres connection for the whole app.
 *
 * Use Supabase's **session pooler** — the pooler host on port **5432**.
 *
 * Supabase also offers a transaction pooler on port 6543. Do not use it here:
 * postgres.js pipelines queries onto a connection, and transaction mode cannot
 * interleave them safely, so anything past two concurrent queries stalls
 * indefinitely rather than erroring. Session mode behaves like a normal
 * Postgres connection and handles the app's concurrency comfortably.
 *
 * The pool is deliberately small and gives idle connections back quickly:
 * session mode holds a server-side connection for as long as the client keeps
 * one, and a serverless platform may run many instances at once.
 */
declare global {
  var __daniSql: postgres.Sql | undefined;
}

const TRANSACTION_POOLER_PORT = "6543";

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your " +
        "Supabase connection string (Project settings → Database → Connection " +
        "string → Session pooler).",
    );
  }
  return url;
}

function usesTransactionPooler(url: string): boolean {
  try {
    return new URL(url).port === TRANSACTION_POOLER_PORT;
  } catch {
    return false;
  }
}

function create(): postgres.Sql {
  const url = connectionString();
  const transactionMode = usesTransactionPooler(url);

  if (transactionMode) {
    console.warn(
      "[db] DATABASE_URL points at the transaction pooler (port 6543). " +
        "Queries can stall there. Switch to the session pooler (port 5432) — " +
        "same host, same credentials, just the other port.",
    );
  }

  const defaultMax = process.env.NODE_ENV === "production" ? 2 : 10;

  return postgres(url, {
    // Prepared statements are disabled to ensure full compatibility with Supabase poolers
    // and avoid collision issues across connection re-use.
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? defaultMax),
    idle_timeout: Number(process.env.DB_IDLE_TIMEOUT ?? 10),
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
