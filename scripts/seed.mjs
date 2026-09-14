/**
 * Seeds the database with PRD Appendix A content, with the §5.9 copy notes
 * already resolved (straight apostrophes → typographic, "Coffee Shop" →
 * "coffee shops", "Remote or Fulltime Roles" → "Remote or full-time roles",
 * the duplicated KUROGI entry left hidden for Dani to confirm or delete).
 *
 *   node scripts/seed.mjs            # create if missing, leave existing data
 *   node scripts/seed.mjs --force    # wipe content tables and reseed
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const root = process.cwd();
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "content.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(root, "lib", "db", "schema.sql"), "utf8"));

const force = process.argv.includes("--force");
const now = () => new Date().toISOString();
const id = () => randomUUID();

function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

if (force) {
  db.exec(`
    DELETE FROM project_media; DELETE FROM project_links; DELETE FROM project_categories;
    DELETE FROM project_tools; DELETE FROM projects; DELETE FROM categories;
    DELETE FROM experiences; DELETE FROM tools; DELETE FROM sections;
    DELETE FROM site_settings; DELETE FROM private_settings;
  `);
  console.log("· cleared existing content");
}

// --- Sections (Appendix A) ---------------------------------------------------
const sections = [
  {
    key: "hero", label: "Intro", sort_order: 1,
    content: {
      greetingMode: "text", greetingText: "Hi, I’m",
      displayName: "Dani Setiadi", nameLayout: "auto", nameScale: 1,
      roleLine: "Graphic Designer & Illustrator",
      locationLine: "Based in Semarang or Surakarta, Indonesia.",
      showLocationIcon: true, portraitStyle: "cutout",
      portraitPosition: { x: 53, y: 100 }, portraitScale: 1,
    },
  },
  {
    key: "work", label: "Work", sort_order: 2,
    content: { lead: "Selected", keyword: "Work", intro: "", showFeatured: true, seeAllLabel: "See all work" },
  },
  {
    key: "about", label: "About", sort_order: 3,
    content: {
      lead: "Let’s", keyword: "Connect",
      bio: "With **10 years of experience**, I create strong brand identities, logos, and standout Instagram visuals for sneaker brands, streetwear labels, and coffee shops. I also specialize in custom characters and mascots built to grab attention.",
      toolsLabel: "Tools", showTools: true, experienceHeading: "Experience",
      showAvailability: true, cvLabel: "Download CV",
    },
  },
  {
    key: "contact", label: "Contact", sort_order: 4,
    content: {
      lead: "Got a project?", keyword: "Say hello.",
      text: "Tell me what you’re building and I’ll come back to you within one or two working days.",
      primaryChannel: "whatsapp", showEmail: true, showWhatsApp: true,
      showSocials: true, showCv: true, showForm: false,
    },
  },
];

const insertSection = db.prepare(
  `INSERT OR IGNORE INTO sections (key, label, sort_order, is_visible, content, updated_at)
   VALUES (?, ?, ?, 1, ?, ?)`,
);
for (const s of sections) insertSection.run(s.key, s.label, s.sort_order, JSON.stringify(s.content), now());

// --- Site settings -----------------------------------------------------------
db.prepare(
  `INSERT OR IGNORE INTO site_settings (id, site_title_pattern, meta_description, contact_email,
     whatsapp_e164, whatsapp_message, social_links, availability, gallery_settings, ui_labels, updated_at)
   VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "%s — Dani Setiadi",
  "Dani Setiadi — Graphic Designer & Illustrator in Semarang, Indonesia. Brand identities, logos, Instagram visuals, characters and mascots.",
  "",
  "",
  "Hi Dani, I saw your portfolio and I’d like to talk about a project.",
  JSON.stringify([
    { platform: "Instagram", label: "Instagram", url: "https://instagram.com/", showInFooter: true, showInContact: true },
    { platform: "Behance", label: "Behance", url: "https://behance.net/", showInFooter: true, showInContact: true },
  ]),
  JSON.stringify({
    status: "open", label: "OPEN FOR WORK", caption: "Remote or full-time roles",
    linkTarget: "contact", hideWhenClosed: false,
  }),
  JSON.stringify({
    layout: "masonry", columns: { desktop: 3, tablet: 2, mobile: 1 }, gap: "M",
    pageSize: { home: 9, work: 12 }, showFilters: true, captionStyle: "below",
    includeFeatured: true, defaultOpenAs: "auto",
  }),
  JSON.stringify({}),
  now(),
);
db.prepare("INSERT OR IGNORE INTO private_settings (id, notification_email, analytics) VALUES (1, '', '{}')").run();

// --- Tools -------------------------------------------------------------------
const insertTool = db.prepare(
  "INSERT INTO tools (id, name, sort_order, is_visible) VALUES (?, ?, ?, 1)",
);
const toolCount = db.prepare("SELECT COUNT(*) AS n FROM tools").get().n;
if (toolCount === 0) {
  ["Clip Studio Paint", "Adobe Illustrator", "Adobe Photoshop", "Affinity Designer"].forEach(
    (name, i) => insertTool.run(id(), name, i + 1),
  );
}

// --- Experience (Appendix A; §5.9 notes applied) ------------------------------
const expCount = db.prepare("SELECT COUNT(*) AS n FROM experiences").get().n;
if (expCount === 0) {
  const insertExp = db.prepare(
    `INSERT INTO experiences (id, company, role, work_type, start_year, end_year, is_current,
       description, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertExp.run(
    id(), "SHOES AND CARE SMG", "Graphic Designer", "Remote", 2019, 2023, 0,
    "Built the in-store and social visual language for a sneaker-care brand — campaign artwork, price lists and seasonal promotions.",
    1, 1,
  );
  insertExp.run(
    id(), "KUROGI SMG", "Graphic Designer & Digital Illustrator", "Remote", 2019, 2023, 0,
    "Creating promotional materials, café menus and merchandise designs.",
    2, 1,
  );
  // §5.9 note 2: the reference repeats this entry. Seeded hidden for Dani to
  // confirm the real third role, or delete.
  insertExp.run(
    id(), "KUROGI SMG", "Graphic Designer & Digital Illustrator", "Remote", 2019, 2023, 0,
    "Duplicate in the CV reference — confirm the real third entry or delete this one.",
    3, 0,
  );
}

// --- Categories (§16 open question 5 proposal) --------------------------------
const catCount = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
if (catCount === 0) {
  const insertCat = db.prepare(
    "INSERT INTO categories (id, name, slug, sort_order, is_visible) VALUES (?, ?, ?, ?, 1)",
  );
  [
    ["Brand Identity", "brand-identity"],
    ["Logo Design", "logo-design"],
    ["Social Media Visuals", "social-media-visuals"],
    ["Characters & Mascots", "characters-mascots"],
    ["Illustration", "illustration"],
    ["Print & Merch", "print-merch"],
    ["Motion & Video", "motion-video"],
  ].forEach(([name, slug], i) => insertCat.run(id(), name, slug, i + 1));
}

// --- Admin allowlist ---------------------------------------------------------
const adminCount = db.prepare("SELECT COUNT(*) AS n FROM admin_users").get().n;
if (adminCount === 0) {
  const email = process.env.ADMIN_EMAIL || "dani@example.com";
  const password = process.env.ADMIN_PASSWORD || "change-me-now";
  db.prepare(
    "INSERT INTO admin_users (user_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id(), email.toLowerCase(), hashPassword(password), "Dani Setiadi", "owner", now());
  console.log(`· admin created — ${email} / ${password}`);
  if (!process.env.ADMIN_PASSWORD) console.log("  ⚠  Change this password after your first sign-in.");
}

console.log("✓ seed complete");
db.close();
