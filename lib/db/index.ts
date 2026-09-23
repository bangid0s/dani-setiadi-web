import "server-only";
import postgres from "postgres";

/**
 * Postgres connection for the whole app.
 *
 * Works with either Supabase pooler: the transaction pooler (port 6543, the one
 * built for serverless) or the session pooler (port 5432). A session-pooler
 * URL is upgraded to 6543 automatically, because on Vercel every warm instance
 * holds its own connections and session mode runs out of them.
 *
 * The one setting that makes 6543 safe is `max_pipeline: 0`. By default
 * postgres.js pipelines — it writes a second query onto a connection before
 * the first has answered. Supavisor's transaction mode cannot interleave
 * those, and past two concurrent queries it stalls forever instead of
 * erroring: the page just spins until the platform times it out. With
 * pipelining off, each connection carries exactly one query at a time, which
 * is what a transaction pooler expects.
 *
 * The remaining settings keep a cold serverless instance cheap: no type
 * lookup on connect, and idle connections are handed back quickly so a frozen
 * instance never wakes up holding a socket the pooler already dropped.
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
  // Set DB_KEEP_PORT=1 to use the session pooler exactly as configured.
  if (!process.env.DB_KEEP_PORT && url.includes("pooler.supabase.com") && url.includes(":5432/")) {
    return url.replace(":5432/", ":6543/");
  }
  return url;
}

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function create(): postgres.Sql {
  const url = connectionString();

  return postgres(url, {
    // Supabase requires SSL; the local PGlite test server does not speak it.
    ssl: isLocal(url) ? false : "require",
    // Supavisor's transaction mode cannot keep prepared statements.
    prepare: false,
    // One query per connection at a time — see the note above. postgres.js
    // reads this option (src/index.js) but its type definitions omit it.
    ...({ max_pipeline: 0 } as object),
    // The app never reads Postgres array columns, so skip the extra
    // round trip postgres.js makes on every new connection to learn them.
    fetch_types: false,
    max: Number(process.env.DB_POOL_MAX ?? 4),
    idle_timeout: Number(process.env.DB_IDLE_TIMEOUT ?? 5),
    max_lifetime: 60 * 5,
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
