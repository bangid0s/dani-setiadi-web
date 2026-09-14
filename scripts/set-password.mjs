/**
 * Reset an admin password from the command line — the way back in if nobody
 * can sign in.
 *
 *   npm run admin:password -- dani@example.com "a new strong password"
 */
import { randomBytes, scryptSync } from "node:crypto";
import { connect } from "./db.mjs";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run admin:password -- <email> "<new password>"');
  process.exit(1);
}
if (password.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}

const sql = connect();
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}`;

const [existing] = await sql`
  select user_id from admin_users where lower(email) = lower(${email})`;

if (existing) {
  await sql`update admin_users set password_hash = ${hash} where user_id = ${existing.user_id}`;
  await sql`delete from sessions where user_id = ${existing.user_id}`;
  console.log(`✓ password changed for ${email} — other devices signed out`);
} else {
  await sql`
    insert into admin_users (email, password_hash, role)
    values (${email.toLowerCase()}, ${hash}, 'owner')`;
  console.log(`✓ admin created — ${email}`);
}
await sql`delete from login_attempts where identifier = ${email.toLowerCase()}`;
await sql.end();
