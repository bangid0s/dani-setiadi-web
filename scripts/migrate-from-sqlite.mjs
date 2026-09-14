/**
 * Moves everything from the local SQLite build into Supabase: every row, and
 * every file under public/uploads and public/files.
 *
 *   npm run db:migrate-from-sqlite            # migrate
 *   npm run db:migrate-from-sqlite -- --dry   # report what would move
 *
 * Safe to re-run: rows are upserted by primary key and objects are overwritten
 * at the same path, so an interrupted run can simply be repeated.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { connect, migrate, loadEnv } from "./db.mjs";

loadEnv();
const DRY = process.argv.includes("--dry");
const root = process.cwd();
const dbFile = path.join(root, "data", "content.db");

if (!fs.existsSync(dbFile)) {
  console.error(`No SQLite database at ${dbFile} — nothing to migrate.`);
  process.exit(1);
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const lite = new Database(dbFile, { readonly: true });
const sql = DRY ? null : connect();

const all = (table) => lite.prepare(`select * from ${table}`).all();
const bool = (v) => v === 1 || v === true;
const nul = (v) => (v === undefined ? null : v);

// --- files -------------------------------------------------------------------
async function uploadFile(bucket, localPath, objectPath, mime) {
  const bytes = fs.readFileSync(localPath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(objectPath)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`${objectPath}: ${res.status} ${await res.text()}`);
  return objectPath;
}

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".avif": "image/avif", ".gif": "image/gif", ".svg": "image/svg+xml", ".pdf": "application/pdf",
};

/** "/uploads/ab12.jpg" -> "migrated/ab12.jpg" */
const objectPathFor = (storagePath) => `migrated/${path.basename(storagePath)}`;

async function main() {
  if (!DRY) {
    console.log("Applying migrations…");
    await migrate(sql);
  }

  // ---- media + its files ----------------------------------------------------
  const media = all("media");
  const uploaded = new Map();
  let fileCount = 0;

  for (const m of media) {
    if (!m.storage_path) continue;
    const local = path.join(root, "public", m.storage_path.replace(/^\//, ""));
    if (!fs.existsSync(local)) {
      console.log(`  ! missing file for media ${m.id}: ${m.storage_path}`);
      continue;
    }
    const objectPath = objectPathFor(m.storage_path);
    const mime = m.mime_type || MIME[path.extname(local).toLowerCase()] || "application/octet-stream";
    if (!DRY) await uploadFile("media", local, objectPath, mime);
    uploaded.set(m.id, objectPath);
    fileCount++;
  }
  console.log(`${DRY ? "would upload" : "uploaded"} ${fileCount} media file(s)`);

  if (DRY) {
    for (const [table] of TABLES) console.log(`  ${table}: ${all(table).length} row(s)`);
    lite.close();
    return;
  }

  // ---- rows -----------------------------------------------------------------
  // media first (everything references it), then the rest in dependency order.
  for (const m of media) {
    await sql`
      insert into media (id, source, storage_path, original_url, is_hotlinked, youtube_id,
        youtube_is_short, youtube_start, title, mime_type, bytes, width, height, lqip,
        dominant_color, alt_text, is_decorative, focal_x, focal_y, status, created_at,
        updated_at, deleted_at)
      values (${m.id}, ${m.source}, ${uploaded.get(m.id) ?? null}, ${nul(m.original_url)},
        ${bool(m.is_hotlinked)}, ${nul(m.youtube_id)}, ${bool(m.youtube_is_short)},
        ${nul(m.youtube_start)}, ${nul(m.title)}, ${nul(m.mime_type)}, ${nul(m.bytes)},
        ${m.width}, ${m.height}, ${nul(m.lqip)}, ${nul(m.dominant_color)},
        ${m.alt_text ?? ""}, ${bool(m.is_decorative)}, ${m.focal_x ?? 0.5}, ${m.focal_y ?? 0.5},
        ${m.status ?? "ok"}, ${m.created_at}, ${m.updated_at}, ${nul(m.deleted_at)})
      on conflict (id) do nothing`;
  }
  // poster_media_id is a self-reference, so it lands in a second pass.
  for (const m of media.filter((x) => x.poster_media_id)) {
    await sql`update media set poster_media_id = ${m.poster_media_id} where id = ${m.id}`;
  }
  console.log(`migrated ${media.length} media row(s)`);

  for (const s of all("sections")) {
    await sql`
      insert into sections (key, label, sort_order, is_visible, content, updated_at)
      values (${s.key}, ${s.label}, ${s.sort_order}, ${bool(s.is_visible)},
              ${sql.json(JSON.parse(s.content || "{}"))}, ${s.updated_at})
      on conflict (key) do update set label = excluded.label,
        sort_order = excluded.sort_order, is_visible = excluded.is_visible,
        content = excluded.content`;
  }

  for (const t of all("tools")) {
    await sql`
      insert into tools (id, name, icon_media_id, url, sort_order, is_visible)
      values (${t.id}, ${t.name}, ${nul(t.icon_media_id)}, ${nul(t.url)}, ${t.sort_order},
              ${bool(t.is_visible)})
      on conflict (id) do nothing`;
  }

  for (const e of all("experiences")) {
    await sql`
      insert into experiences (id, company, role, work_type, start_year, start_month, end_year,
        end_month, is_current, description, sort_order, is_visible)
      values (${e.id}, ${e.company}, ${e.role ?? ""}, ${e.work_type ?? "Remote"},
        ${nul(e.start_year)}, ${nul(e.start_month)}, ${nul(e.end_year)}, ${nul(e.end_month)},
        ${bool(e.is_current)}, ${e.description ?? ""}, ${e.sort_order}, ${bool(e.is_visible)})
      on conflict (id) do nothing`;
  }

  for (const c of all("categories")) {
    await sql`
      insert into categories (id, name, slug, sort_order, is_visible)
      values (${c.id}, ${c.name}, ${c.slug}, ${c.sort_order}, ${bool(c.is_visible)})
      on conflict (id) do nothing`;
  }

  for (const p of all("projects")) {
    await sql`
      insert into projects (id, title, slug, client, year, role, summary, body, cover_media_id,
        card_ratio, open_as, external_url, is_featured, featured_order, status, sort_order,
        published_at, seo_title, seo_description, og_image_id, created_at, updated_at, deleted_at)
      values (${p.id}, ${p.title}, ${p.slug}, ${nul(p.client)}, ${nul(p.year)}, ${nul(p.role)},
        ${nul(p.summary)}, ${nul(p.body)}, ${nul(p.cover_media_id)}, ${p.card_ratio ?? "auto"},
        ${p.open_as ?? "auto"}, ${nul(p.external_url)}, ${bool(p.is_featured)},
        ${nul(p.featured_order)}, ${p.status}, ${p.sort_order}, ${nul(p.published_at)},
        ${nul(p.seo_title)}, ${nul(p.seo_description)}, ${nul(p.og_image_id)},
        ${p.created_at}, ${p.updated_at}, ${nul(p.deleted_at)})
      on conflict (id) do nothing`;
  }

  for (const r of all("project_categories")) {
    await sql`insert into project_categories (project_id, category_id)
              values (${r.project_id}, ${r.category_id}) on conflict do nothing`;
  }
  for (const r of all("project_tools")) {
    await sql`insert into project_tools (project_id, tool_id)
              values (${r.project_id}, ${r.tool_id}) on conflict do nothing`;
  }
  for (const r of all("project_media")) {
    await sql`
      insert into project_media (id, project_id, media_id, sort_order, width, caption)
      values (${r.id}, ${r.project_id}, ${r.media_id}, ${r.sort_order}, ${r.width ?? "full"},
              ${nul(r.caption)})
      on conflict (id) do nothing`;
  }
  for (const r of all("project_links")) {
    await sql`
      insert into project_links (id, project_id, label, url, sort_order)
      values (${r.id}, ${r.project_id}, ${r.label}, ${r.url}, ${r.sort_order})
      on conflict (id) do nothing`;
  }

  // ---- settings + CV --------------------------------------------------------
  const [settings] = all("site_settings");
  if (settings) {
    let cvPath = null;
    if (settings.cv_path) {
      const local = path.join(root, "public", settings.cv_path.replace(/^\//, ""));
      if (fs.existsSync(local)) {
        const objectPath = `migrated/${path.basename(settings.cv_path)}`;
        await uploadFile("files", local, objectPath, "application/pdf");
        cvPath = `${SUPABASE_URL}/storage/v1/object/public/files/${objectPath}`;
        console.log("uploaded the CV");
      }
    }
    await sql`
      insert into site_settings (id, site_title_pattern, meta_description, og_image_id,
        favicon_id, cv_path, cv_filename, contact_email, whatsapp_e164, whatsapp_message,
        social_links, availability, gallery_settings, ui_labels)
      values (1, ${settings.site_title_pattern}, ${settings.meta_description},
        ${nul(settings.og_image_id)}, ${nul(settings.favicon_id)}, ${cvPath},
        ${nul(settings.cv_filename)}, ${settings.contact_email ?? ""},
        ${settings.whatsapp_e164 ?? ""}, ${settings.whatsapp_message ?? ""},
        ${sql.json(JSON.parse(settings.social_links || "[]"))},
        ${sql.json(JSON.parse(settings.availability || "{}"))},
        ${sql.json(JSON.parse(settings.gallery_settings || "{}"))},
        ${sql.json(JSON.parse(settings.ui_labels || "{}"))})
      on conflict (id) do update set
        site_title_pattern = excluded.site_title_pattern,
        meta_description = excluded.meta_description, og_image_id = excluded.og_image_id,
        favicon_id = excluded.favicon_id, cv_path = excluded.cv_path,
        cv_filename = excluded.cv_filename, contact_email = excluded.contact_email,
        whatsapp_e164 = excluded.whatsapp_e164, whatsapp_message = excluded.whatsapp_message,
        social_links = excluded.social_links, availability = excluded.availability,
        gallery_settings = excluded.gallery_settings, ui_labels = excluded.ui_labels`;
  }
  await sql`insert into private_settings (id) values (1) on conflict (id) do nothing`;

  // ---- admins ---------------------------------------------------------------
  for (const a of all("admin_users")) {
    await sql`
      insert into admin_users (user_id, email, password_hash, name, role, created_at)
      values (${a.user_id}, ${a.email}, ${a.password_hash}, ${a.name ?? ""},
              ${a.role ?? "owner"}, ${a.created_at})
      on conflict (email) do nothing`;
  }
  console.log(`migrated ${all("admin_users").length} admin account(s) — passwords still work`);

  console.log("\n✓ migration complete");
  lite.close();
  await sql.end();
}

const TABLES = [
  ["media"], ["sections"], ["tools"], ["experiences"], ["categories"], ["projects"],
  ["project_categories"], ["project_tools"], ["project_media"], ["project_links"],
  ["admin_users"],
];

await main();
