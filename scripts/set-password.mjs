/**
 * Reset an admin password from the command line — the way back in if nobody
 * can sign in.
 *
 *   npm run admin:password -- dani@example.com "a new strong password"
 */
import Database from "better-sqlite3";
import path from "node:path";
import { randomBytes, scryptSync, randomUUID } from "node:crypto";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run admin:password -- <email> "<new password>"');
  process.exit(1);
}
if (password.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}

const db = new Database(path.join(process.cwd(), "data", "content.db"));
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}`;

const existing = db.prepare("SELECT user_id FROM admin_users WHERE LOWER(email) = LOWER(?)").get(email);
if (existing) {
  db.prepare("UPDATE admin_users SET password_hash = ? WHERE user_id = ?").run(hash, existing.user_id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.user_id);
  console.log(`✓ password changed for ${email} — other devices signed out`);
} else {
  db.prepare(
    "INSERT INTO admin_users (user_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, '', 'owner', ?)",
  ).run(randomUUID(), email.toLowerCase(), hash, new Date().toISOString());
  console.log(`✓ admin created — ${email}`);
}
db.prepare("DELETE FROM login_attempts WHERE identifier = ?").run(email.toLowerCase());
db.close();
