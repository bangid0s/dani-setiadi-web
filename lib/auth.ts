import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "@/lib/db";
import { newToken } from "@/lib/ids";
import type { AdminUser } from "@/lib/types";

const scrypt = promisify(scryptCb) as (p: string | Buffer, s: Buffer, k: number) => Promise<Buffer>;

const SESSION_COOKIE = "dani_admin_session";
const SESSION_DAYS = 14;
const KEYLEN = 64;

// PRD ADM-04 — rate limiting and temporary lockout after repeated failures.
const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

type Row = Record<string, unknown>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function isRateLimited(identifier: string): Promise<boolean> {
  await sql`
    delete from login_attempts
    where at < now() - ${`${WINDOW_MINUTES} minutes`}::interval`;
  const [r] = await sql<Row[]>`
    select count(*)::int as n from login_attempts
    where identifier = ${identifier}
      and at > now() - ${`${WINDOW_MINUTES} minutes`}::interval`;
  return Number(r.n) >= MAX_ATTEMPTS;
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  await sql`insert into login_attempts (identifier) values (${identifier})`;
}

export async function clearAttempts(identifier: string): Promise<void> {
  await sql`delete from login_attempts where identifier = ${identifier}`;
}

function rowToUser(r: Row | undefined): AdminUser | null {
  if (!r) return null;
  return {
    userId: String(r.user_id),
    email: String(r.email),
    name: String(r.name ?? ""),
    role: (r.role as AdminUser["role"]) ?? "owner",
    createdAt: String(r.created_at ?? ""),
  };
}

/** ADM-02 — allowlist only; there is no public sign-up. */
export async function findAdminByEmail(
  email: string,
): Promise<(AdminUser & { passwordHash: string }) | null> {
  const [r] = await sql<Row[]>`
    select * from admin_users where lower(email) = lower(${email.trim()})`;
  const user = rowToUser(r);
  return user ? { ...user, passwordHash: String(r.password_hash) } : null;
}

export async function listAdmins(): Promise<AdminUser[]> {
  const rows = await sql<Row[]>`select * from admin_users order by created_at asc`;
  return rows.map((r) => rowToUser(r)!).filter(Boolean);
}

export async function createAdmin(
  email: string,
  password: string,
  name = "",
  role: AdminUser["role"] = "maintainer",
): Promise<string> {
  const [row] = await sql<Row[]>`
    insert into admin_users (email, password_hash, name, role)
    values (${email.trim().toLowerCase()}, ${await hashPassword(password)}, ${name}, ${role})
    returning user_id`;
  return String(row.user_id);
}

export async function setAdminPassword(userId: string, password: string): Promise<void> {
  await sql`
    update admin_users set password_hash = ${await hashPassword(password)}
    where user_id = ${userId}`;
  // Force other devices to sign in again.
  await sql`delete from sessions where user_id = ${userId}`;
}

export async function deleteAdmin(userId: string): Promise<void> {
  await sql`delete from admin_users where user_id = ${userId}`;
}

export async function countAdmins(): Promise<number> {
  const [r] = await sql<Row[]>`select count(*)::int as n from admin_users`;
  return Number(r.n);
}

export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  // Prune expired sessions on login to keep sessions table clean without slowing reads
  await sql`delete from sessions where expires_at < now()`;
  await sql`
    insert into sessions (token, user_id, expires_at)
    values (${token}, ${userId}, ${expires.toISOString()})`;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token = ${token}`;
  store.delete(SESSION_COOKIE);
}

/** Current admin, or null. Cached per request; never executes a write query on read. */
export const currentAdmin = cache(async (): Promise<AdminUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [r] = await sql<Row[]>`
    select u.* from sessions s
    join admin_users u on u.user_id = s.user_id
    where s.token = ${token} and s.expires_at > now()`;
  return rowToUser(r);
});

/**
 * ADM-03 — every server action re-checks admin rights. Never trust the UI.
 * Throws, so a forgotten check fails closed rather than open.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
