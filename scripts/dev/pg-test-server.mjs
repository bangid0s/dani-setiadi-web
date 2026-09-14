/**
 * Dev-only: a real Postgres over the wire protocol, backed by PGlite (Postgres
 * compiled to WASM). Used to exercise the production SQL path — migrations,
 * driver, queries — without needing a Supabase project.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: 5555, host: "127.0.0.1" });
await server.start();
console.log("READY postgresql://postgres@127.0.0.1:5555/postgres");

const stop = async () => { await server.stop(); await db.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
