import "server-only";
import { cookies } from "next/headers";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, nowIso } from "@/lib/db";
import { newId, newToken } from "@/lib/ids";
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

export function isRateLimited(identifier: string): boolean {
  db.prepare("DELETE FROM login_attempts WHERE at < datetime('now', ?)").run(
    `-${WINDOW_MINUTES} minutes`,
  );
  const r = db
    .prepare(
      "SELECT COUNT(*) AS n FROM login_attempts WHERE identifier = ? AND at > datetime('now', ?)",
    )
    .get(identifier, `-${WINDOW_MINUTES} minutes`) as Row;
  return Number(r.n) >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(identifier: string): void {
  db.prepare("INSERT INTO login_attempts (identifier, at) VALUES (?, datetime('now'))").run(identifier);
}

export function clearAttempts(identifier: string): void {
  db.prepare("DELETE FROM login_attempts WHERE identifier = ?").run(identifier);
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
export function findAdminByEmail(email: string): (AdminUser & { passwordHash: string }) | null {
  const r = db
    .prepare("SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)")
    .get(email.trim()) as Row | undefined;
  const user = rowToUser(r);
  return user ? { ...user, passwordHash: String(r!.password_hash) } : null;
}

export function listAdmins(): AdminUser[] {
  const rows = db.prepare("SELECT * FROM admin_users ORDER BY created_at ASC").all() as Row[];
  return rows.map((r) => rowToUser(r)!).filter(Boolean);
}

export async function createAdmin(
  email: string,
  password: string,
  name = "",
  role: AdminUser["role"] = "maintainer",
): Promise<string> {
  const id = newId();
  db.prepare(
    "INSERT INTO admin_users (user_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, email.trim().toLowerCase(), await hashPassword(password), name, role, nowIso());
  return id;
}

export async function setAdminPassword(userId: string, password: string): Promise<void> {
  db.prepare("UPDATE admin_users SET password_hash = ? WHERE user_id = ?").run(
    await hashPassword(password),
    userId,
  );
  // Force other devices to sign in again.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function deleteAdmin(userId: string): void {
  db.prepare("DELETE FROM admin_users WHERE user_id = ?").run(userId);
}

export function countAdmins(): number {
  return Number((db.prepare("SELECT COUNT(*) AS n FROM admin_users").get() as Row).n);
}

export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    expires.toISOString(),
    nowIso(),
  );
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
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(SESSION_COOKIE);
}

/** Current admin, or null. Expired sessions are pruned on read. */
export async function currentAdmin(): Promise<AdminUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  const r = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN admin_users u ON u.user_id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, nowIso()) as Row | undefined;
  return rowToUser(r);
}

/**
 * ADM-03 — every server action re-checks admin rights. Never trust the UI.
 * Throws, so a forgotten check fails closed rather than open.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
