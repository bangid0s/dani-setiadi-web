/**
 * Creates the schema and seeds PRD Appendix A content, with the §5.9 copy notes
 * already resolved. Safe to re-run: it never overwrites content that exists.
 *
 *   npm run db:setup
 */
import { randomBytes, scryptSync } from "node:crypto";
import { connect, migrate } from "./db.mjs";

const sql = connect();

function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}`;
}

console.log("Applying migrations…");
await migrate(sql);

console.log("Seeding content…");

// --- Sections (Appendix A) ---------------------------------------------------
const sections = [
  ["hero", "Intro", 1, {
    greetingMode: "text", greetingText: "Hi, I’m",
    displayName: "Dani Setiadi", nameLayout: "auto", nameScale: 1,
    roleLine: "Graphic Designer & Illustrator",
    locationLine: "Based in Semarang or Surakarta, Indonesia.",
    showLocationIcon: true, portraitStyle: "cutout",
    portraitPosition: { x: 53, y: 100 }, portraitScale: 1,
  }],
  ["work", "Work", 2, {
    lead: "Selected", keyword: "Work", intro: "",
    showFeatured: true, seeAllLabel: "See all work",
  }],
  ["about", "About", 3, {
    lead: "Let’s", keyword: "Connect",
    bio: "With **10 years of experience**, I create strong brand identities, logos, and standout Instagram visuals for sneaker brands, streetwear labels, and coffee shops. I also specialize in custom characters and mascots built to grab attention.",
    toolsLabel: "Tools", showTools: true, experienceHeading: "Experience",
    showAvailability: true, cvLabel: "Download CV",
  }],
  ["contact", "Contact", 4, {
    lead: "Got a project?", keyword: "Say hello.",
    text: "Tell me what you’re building and I’ll come back to you within one or two working days.",
    primaryChannel: "whatsapp", showEmail: true, showWhatsApp: true,
    showSocials: true, showCv: true, showForm: false,
  }],
];
for (const [key, label, order, content] of sections) {
  await sql`
    insert into sections (key, label, sort_order, is_visible, content)
    values (${key}, ${label}, ${order}, true, ${sql.json(content)})
    on conflict (key) do nothing`;
}

// --- Site settings -----------------------------------------------------------
await sql`
  insert into site_settings (id, site_title_pattern, meta_description, whatsapp_message,
    social_links, availability, gallery_settings, ui_labels)
  values (1, ${"%s — Dani Setiadi"},
    ${"Dani Setiadi — Graphic Designer & Illustrator in Semarang, Indonesia. Brand identities, logos, Instagram visuals, characters and mascots."},
    ${"Hi Dani, I saw your portfolio and I’d like to talk about a project."},
    ${sql.json([
      { platform: "Instagram", label: "Instagram", url: "https://instagram.com/", showInFooter: true, showInContact: true },
      { platform: "Behance", label: "Behance", url: "https://behance.net/", showInFooter: true, showInContact: true },
    ])},
    ${sql.json({ status: "open", label: "OPEN FOR WORK", caption: "Remote or full-time roles", linkTarget: "contact", hideWhenClosed: false })},
    ${sql.json({ layout: "masonry", columns: { desktop: 3, tablet: 2, mobile: 1 }, gap: "M",
                 pageSize: { home: 9, work: 12 }, showFilters: true, captionStyle: "below",
                 includeFeatured: true, defaultOpenAs: "auto" })},
    ${sql.json({})})
  on conflict (id) do nothing`;
await sql`insert into private_settings (id) values (1) on conflict (id) do nothing`;

// --- Tools -------------------------------------------------------------------
const [{ n: toolCount }] = await sql`select count(*)::int as n from tools`;
if (toolCount === 0) {
  const names = ["Clip Studio Paint", "Adobe Illustrator", "Adobe Photoshop", "Affinity Designer"];
  for (const [i, name] of names.entries()) {
    await sql`insert into tools (name, sort_order) values (${name}, ${i + 1})`;
  }
}

// --- Experience (Appendix A; §5.9 notes applied) ------------------------------
const [{ n: expCount }] = await sql`select count(*)::int as n from experiences`;
if (expCount === 0) {
  const rows = [
    ["SHOES AND CARE SMG", "Graphic Designer", 2019, 2023,
     "Built the in-store and social visual language for a sneaker-care brand — campaign artwork, price lists and seasonal promotions.", 1, true],
    ["KUROGI SMG", "Graphic Designer & Digital Illustrator", 2019, 2023,
     "Creating promotional materials, café menus and merchandise designs.", 2, true],
    // §5.9 note 2: the reference repeats this entry. Seeded hidden so Dani can
    // confirm the real third role, or delete it.
    ["KUROGI SMG", "Graphic Designer & Digital Illustrator", 2019, 2023,
     "Duplicate in the CV reference — confirm the real third entry or delete this one.", 3, false],
  ];
  for (const [company, role, sy, ey, description, order, visible] of rows) {
    await sql`
      insert into experiences (company, role, work_type, start_year, end_year, description,
        sort_order, is_visible)
      values (${company}, ${role}, 'Remote', ${sy}, ${ey}, ${description}, ${order}, ${visible})`;
  }
}

// --- Categories (§16 open question 5 proposal) --------------------------------
const [{ n: catCount }] = await sql`select count(*)::int as n from categories`;
if (catCount === 0) {
  const cats = [
    ["Brand Identity", "brand-identity"], ["Logo Design", "logo-design"],
    ["Social Media Visuals", "social-media-visuals"], ["Characters & Mascots", "characters-mascots"],
    ["Illustration", "illustration"], ["Print & Merch", "print-merch"],
    ["Motion & Video", "motion-video"],
  ];
  for (const [i, [name, slug]] of cats.entries()) {
    await sql`insert into categories (name, slug, sort_order) values (${name}, ${slug}, ${i + 1})`;
  }
}

// --- Admin allowlist ----------------------------------------------------------
const [{ n: adminCount }] = await sql`select count(*)::int as n from admin_users`;
if (adminCount === 0) {
  const email = process.env.ADMIN_EMAIL || "dani@example.com";
  const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  await sql`
    insert into admin_users (email, password_hash, name, role)
    values (${email.toLowerCase()}, ${hashPassword(password)}, 'Dani Setiadi', 'owner')`;
  console.log(`\n  Admin created\n    email:    ${email}\n    password: ${password}`);
  console.log("  Change it after your first sign-in (Settings → Account).\n");
}

console.log("✓ setup complete");
await sql.end();
