/**
 * Optional sample portfolio for visual QA and for trying the admin before real
 * work is loaded. Generates placeholder artwork in mixed ratios (PRD WORK-01's
 * test set) plus one YouTube item.
 *
 *   node scripts/demo-content.mjs          # add demo projects
 *   node scripts/demo-content.mjs --clear  # remove them again
 */
import Database from "better-sqlite3";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root = process.cwd();
const db = new Database(path.join(root, "data", "content.db"));
db.pragma("foreign_keys = ON");

const uploadDir = path.join(root, "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const now = () => new Date().toISOString();
const id = () => randomUUID();
const DEMO_TAG = "[demo]";

if (process.argv.includes("--clear")) {
  const rows = db.prepare("SELECT id, cover_media_id FROM projects WHERE role = ?").all(DEMO_TAG);
  const del = db.prepare("DELETE FROM projects WHERE id = ?");
  const delMedia = db.prepare("DELETE FROM media WHERE id = ?");
  for (const r of rows) {
    db.prepare("SELECT storage_path FROM media WHERE id = ?")
      .all(r.cover_media_id)
      .forEach((m) => {
        if (m.storage_path) fs.rmSync(path.join(root, "public", m.storage_path.slice(1)), { force: true });
      });
    del.run(r.id);
    if (r.cover_media_id) delMedia.run(r.cover_media_id);
  }
  console.log(`✓ removed ${rows.length} demo projects`);
  process.exit(0);
}

const PALETTE = ["#F65117", "#13182B", "#BB3607", "#EEE9DD", "#424242"];

async function makeArtwork(label, w, h, bg, fg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/>
    <circle cx="${w * 0.72}" cy="${h * 0.28}" r="${Math.min(w, h) * 0.18}" fill="${fg}" opacity="0.9"/>
    <rect x="${w * 0.08}" y="${h * 0.62}" width="${w * 0.52}" height="${h * 0.06}" fill="${fg}"/>
    <rect x="${w * 0.08}" y="${h * 0.72}" width="${w * 0.34}" height="${h * 0.06}" fill="${fg}" opacity="0.65"/>
    <text x="${w * 0.08}" y="${h * 0.48}" font-family="Helvetica,Arial,sans-serif"
          font-size="${Math.round(Math.min(w, h) * 0.11)}" font-weight="bold" fill="${fg}">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function lqip(buf) {
  const tiny = await sharp(buf).resize(16, 16, { fit: "inside" }).webp({ quality: 45 }).toBuffer();
  return `data:image/webp;base64,${tiny.toString("base64")}`;
}

const CATS = db.prepare("SELECT id, slug FROM categories").all();
const catBySlug = Object.fromEntries(CATS.map((c) => [c.slug, c.id]));

const DEMO = [
  { title: "Kurogi café identity", cat: "brand-identity", year: 2024, w: 1600, h: 1200, featured: true,
    summary: "A full identity for a Semarang coffee shop — wordmark, cup system, menu boards and a set of in-store signs." },
  { title: "Sneaker drop IG set", cat: "social-media-visuals", year: 2024, w: 1080, h: 1350, featured: true,
    summary: "Twelve feed posts and nine stories for a limited sneaker release." },
  { title: "Bakso mascot", cat: "characters-mascots", year: 2023, w: 1200, h: 1600 },
  { title: "Shoes & Care wordmark", cat: "logo-design", year: 2023, w: 1400, h: 1400 },
  { title: "Café menu set", cat: "print-merch", year: 2023, w: 1240, h: 1754 },
  { title: "Street series", cat: "illustration", year: 2022, w: 1600, h: 900 },
  { title: "Roastery brand board", cat: "brand-identity", year: 2022, w: 1600, h: 1000 },
  { title: "Tote & tee artwork", cat: "print-merch", year: 2022, w: 1080, h: 1080 },
  { title: "Mascot turnaround", cat: "characters-mascots", year: 2021, w: 900, h: 1600 },
];

const insertMedia = db.prepare(
  `INSERT INTO media (id, source, storage_path, title, mime_type, bytes, width, height, lqip,
     alt_text, created_at, updated_at) VALUES (?, 'upload', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertProject = db.prepare(
  `INSERT INTO projects (id, title, slug, client, year, role, summary, cover_media_id, card_ratio,
     open_as, is_featured, featured_order, status, sort_order, published_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'auto', 'auto', ?, ?, 'published', ?, ?, ?, ?)`,
);
const linkCat = db.prepare(
  "INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)",
);

let featuredOrder = 0;
for (const [i, d] of DEMO.entries()) {
  const bg = PALETTE[i % PALETTE.length];
  const fg = bg === "#EEE9DD" ? "#13182B" : "#F5EFE3";
  const buf = await makeArtwork(d.title.split(" ")[0], d.w, d.h, bg, fg);
  const name = `demo-${i}-${Date.now().toString(36)}.jpg`;
  fs.writeFileSync(path.join(uploadDir, name), buf);

  const mediaId = id();
  insertMedia.run(mediaId, `/uploads/${name}`, d.title, "image/jpeg", buf.length, d.w, d.h,
    await lqip(buf), `${d.title} — sample artwork`, now(), now());

  const projectId = id();
  const slug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  insertProject.run(projectId, d.title, slug, "Sample client", d.year, DEMO_TAG,
    d.summary ?? null, mediaId, d.featured ? 1 : 0, d.featured ? ++featuredOrder : null,
    i + 1, now(), now(), now());
  if (catBySlug[d.cat]) linkCat.run(projectId, catBySlug[d.cat]);
}

// One YouTube item, to exercise the 16:9 facade path. The thumbnail is
// imported into our own storage, exactly as the admin flow does (PRD §8.5), so
// the card makes no request to a YouTube domain before a click (WORK-07).
const YT_ID = "aqz-KE-bpKQ";
let ytThumbPath = null;
let ytThumbLqip = null;
try {
  const res = await fetch(`https://i.ytimg.com/vi/${YT_ID}/maxresdefault.jpg`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) {
    const bytes = Buffer.from(await res.arrayBuffer());
    const name = `demo-yt-${Date.now().toString(36)}.jpg`;
    fs.writeFileSync(path.join(uploadDir, name), bytes);
    ytThumbPath = `/uploads/${name}`;
    ytThumbLqip = await lqip(bytes);
  }
} catch {
  console.log("· couldn’t fetch the YouTube thumbnail (offline?) — the card will fall back to i.ytimg.com");
}

const ytMediaId = id();
db.prepare(
  `INSERT INTO media (id, source, original_url, storage_path, lqip, youtube_id, youtube_is_short,
     title, width, height, alt_text, created_at, updated_at)
   VALUES (?, 'youtube', ?, ?, ?, ?, 0, ?, 1280, 720, '', ?, ?)`,
).run(ytMediaId, `https://www.youtube.com/watch?v=${YT_ID}`, ytThumbPath, ytThumbLqip, YT_ID,
  "Big Buck Bunny (sample)", now(), now());
const ytProject = id();
insertProject.run(ytProject, "Motion reel", "motion-reel", "Sample client", 2024, DEMO_TAG,
  "A short motion piece — the card shows a thumbnail and only loads YouTube after a click.",
  ytMediaId, 0, null, DEMO.length + 1, now(), now(), now());
if (catBySlug["motion-video"]) linkCat.run(ytProject, catBySlug["motion-video"]);

console.log(`✓ added ${DEMO.length + 1} demo projects (run with --clear to remove)`);
db.close();
