/**
 * Attaches a placeholder portrait so the hero composition can be checked before
 * Dani's real cutout exists. Replace it in the dashboard under Hero → Portrait.
 *   node scripts/demo-portrait.mjs --clear   # detach and delete it again
 */
import Database from "better-sqlite3";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root = process.cwd();
const db = new Database(path.join(root, "data", "content.db"));
const uploadDir = path.join(root, "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const heroRow = db.prepare("SELECT content FROM sections WHERE key = 'hero'").get();
const content = JSON.parse(heroRow.content);

if (process.argv.includes("--clear")) {
  if (content.portraitId) {
    const m = db.prepare("SELECT storage_path FROM media WHERE id = ?").get(content.portraitId);
    if (m?.storage_path) fs.rmSync(path.join(root, "public", m.storage_path.slice(1)), { force: true });
    db.prepare("DELETE FROM media WHERE id = ?").run(content.portraitId);
  }
  delete content.portraitId;
  db.prepare("UPDATE sections SET content = ? WHERE key = 'hero'").run(JSON.stringify(content));
  console.log("✓ portrait removed");
  process.exit(0);
}

const W = 900, H = 1200;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <g fill="#13182B">
    <path d="M${W*0.5-170} ${H} q0-300 170-330 q170 30 170 330 z"/>
    <ellipse cx="${W*0.5}" cy="${H*0.34}" rx="150" ry="185"/>
    <path d="M${W*0.5-160} ${H*0.27} q160-150 320 0 q-40-130-160-130 q-120 0-160 130z"/>
  </g>
  <g fill="none" stroke="#13182B" stroke-width="9">
    <circle cx="${W*0.5-62}" cy="${H*0.345}" r="58"/>
    <circle cx="${W*0.5+62}" cy="${H*0.345}" r="58"/>
    <path d="M${W*0.5-4} ${H*0.345} h8"/>
  </g>
</svg>`;

const buf = await sharp(Buffer.from(svg)).png().toBuffer();
const name = `portrait-demo-${Date.now().toString(36)}.png`;
fs.writeFileSync(path.join(uploadDir, name), buf);

const tiny = await sharp(buf).resize(16, 16, { fit: "inside" }).webp({ quality: 45 }).toBuffer();
const id = randomUUID();
db.prepare(
  `INSERT INTO media (id, source, storage_path, title, mime_type, bytes, width, height, lqip,
     alt_text, created_at, updated_at) VALUES (?, 'upload', ?, ?, 'image/png', ?, ?, ?, ?, ?, ?, ?)`,
).run(id, `/uploads/${name}`, "Portrait placeholder", buf.length, W, H,
  `data:image/webp;base64,${tiny.toString("base64")}`,
  "Placeholder portrait silhouette", new Date().toISOString(), new Date().toISOString());

content.portraitId = id;
db.prepare("UPDATE sections SET content = ? WHERE key = 'hero'").run(JSON.stringify(content));
console.log("✓ placeholder portrait attached — replace it in the dashboard under Hero");
db.close();
