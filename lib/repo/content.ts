import { db, parseJson, toBool, nowIso } from "@/lib/db";
import { newId, slugify } from "@/lib/ids";
import { getMedia, getMediaMany } from "@/lib/repo/media";
import { parseSectionContent, availabilitySchema, gallerySettingsSchema, uiLabelsSchema } from "@/lib/validation";
import type {
  AboutContent, Availability, Category, ContactContent, Experience, GallerySettings,
  HeroContent, Project, ProjectLink, ProjectMediaItem, Section, SectionKey, SiteSettings,
  SocialLink, Tool, UiLabels, WorkContent,
} from "@/lib/types";

type Row = Record<string, unknown>;

// --- Sections ---------------------------------------------------------------

const CHAPTER_ORDER: SectionKey[] = ["hero", "work", "about", "contact"];

export function listSections(opts: { visibleOnly?: boolean } = {}): Section[] {
  const rows = db.prepare("SELECT * FROM sections ORDER BY sort_order ASC").all() as Row[];
  const all = rows.map((r) => ({
    key: r.key as SectionKey,
    label: String(r.label ?? ""),
    sortOrder: Number(r.sort_order),
    isVisible: toBool(r.is_visible),
    content: parseSectionContent(String(r.key), parseJson(r.content, {})),
    index: 0,
  })) as Section[];

  // GLB-02 — index numbers are generated from the *visible* order.
  let n = 0;
  for (const s of all) if (s.isVisible) s.index = ++n;

  return opts.visibleOnly ? all.filter((s) => s.isVisible) : all;
}

export function getSection<T>(key: SectionKey): Section<T> | null {
  return (listSections().find((s) => s.key === key) as Section<T> | undefined) ?? null;
}

export const heroSection = () => getSection<HeroContent>("hero");
export const workSection = () => getSection<WorkContent>("work");
export const aboutSection = () => getSection<AboutContent>("about");
export const contactSection = () => getSection<ContactContent>("contact");

export function updateSectionContent(key: SectionKey, content: unknown): void {
  db.prepare("UPDATE sections SET content = ?, updated_at = ? WHERE key = ?").run(
    JSON.stringify(content),
    nowIso(),
    key,
  );
}

export function updateSectionMeta(key: SectionKey, patch: { label?: string; isVisible?: boolean }): void {
  if (patch.label !== undefined)
    db.prepare("UPDATE sections SET label = ? WHERE key = ?").run(patch.label, key);
  if (patch.isVisible !== undefined)
    db.prepare("UPDATE sections SET is_visible = ? WHERE key = ?").run(patch.isVisible ? 1 : 0, key);
}

export function reorderSections(keys: string[]): void {
  const stmt = db.prepare("UPDATE sections SET sort_order = ? WHERE key = ?");
  db.transaction(() => {
    keys.forEach((key, i) => {
      if (CHAPTER_ORDER.includes(key as SectionKey)) stmt.run(i + 1, key);
    });
  })();
}

// --- Site settings ----------------------------------------------------------

const DEFAULT_UI_LABELS: UiLabels = uiLabelsSchema.parse({});

export function getSettings(): SiteSettings {
  const r = (db.prepare("SELECT * FROM site_settings WHERE id = 1").get() ?? {}) as Row;
  const availability = availabilitySchema.parse(parseJson(r.availability, {}));
  const gallery = gallerySettingsSchema.parse(parseJson(r.gallery_settings, {}));
  const stored = parseJson<Partial<UiLabels> & { showFloatingWhatsApp?: boolean }>(r.ui_labels, {});
  const uiLabels = uiLabelsSchema.parse(stored);
  return {
    siteTitlePattern: String(r.site_title_pattern ?? "%s — Dani Setiadi"),
    metaDescription: String(r.meta_description ?? ""),
    ogImageId: (r.og_image_id as string) ?? null,
    ogImage: getMedia(r.og_image_id as string),
    faviconId: (r.favicon_id as string) ?? null,
    favicon: getMedia(r.favicon_id as string),
    cvPath: (r.cv_path as string) ?? null,
    cvFilename: (r.cv_filename as string) ?? null,
    contactEmail: String(r.contact_email ?? ""),
    whatsappE164: String(r.whatsapp_e164 ?? ""),
    whatsappMessage: String(r.whatsapp_message ?? ""),
    socialLinks: parseJson<SocialLink[]>(r.social_links, []),
    availability: availability as Availability,
    gallery: gallery as GallerySettings,
    uiLabels: { ...DEFAULT_UI_LABELS, ...uiLabels },
    showFloatingWhatsApp: stored.showFloatingWhatsApp === true,
  };
}

export function updateSettings(patch: Record<string, unknown>): void {
  const map: Record<string, string> = {
    siteTitlePattern: "site_title_pattern",
    metaDescription: "meta_description",
    ogImageId: "og_image_id",
    faviconId: "favicon_id",
    cvPath: "cv_path",
    cvFilename: "cv_filename",
    contactEmail: "contact_email",
    whatsappE164: "whatsapp_e164",
    whatsappMessage: "whatsapp_message",
  };
  const jsonMap: Record<string, string> = {
    socialLinks: "social_links",
    availability: "availability",
    gallery: "gallery_settings",
    uiLabels: "ui_labels",
  };
  const sets: string[] = [];
  const params: Record<string, unknown> = { now: nowIso() };
  for (const [key, column] of Object.entries(map)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = @${key}`);
    params[key] = patch[key];
  }
  for (const [key, column] of Object.entries(jsonMap)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = @${key}`);
    params[key] = JSON.stringify(patch[key]);
  }
  if (sets.length === 0) return;
  db.prepare(`UPDATE site_settings SET ${sets.join(", ")}, updated_at = @now WHERE id = 1`).run(params);
}

// --- Tools ------------------------------------------------------------------

export function listTools(opts: { visibleOnly?: boolean } = {}): Tool[] {
  const rows = db
    .prepare(
      `SELECT * FROM tools ${opts.visibleOnly ? "WHERE is_visible = 1" : ""} ORDER BY sort_order ASC`,
    )
    .all() as Row[];
  const icons = getMediaMany(rows.map((r) => r.icon_media_id as string).filter(Boolean));
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    iconMediaId: (r.icon_media_id as string) ?? null,
    icon: r.icon_media_id ? (icons.get(String(r.icon_media_id)) ?? null) : null,
    url: (r.url as string) ?? null,
    sortOrder: Number(r.sort_order),
    isVisible: toBool(r.is_visible),
  }));
}

export function createTool(input: { name: string; iconMediaId?: string | null; url?: string | null; isVisible?: boolean }): string {
  const id = newId();
  const next = nextSortOrder("tools");
  db.prepare(
    "INSERT INTO tools (id, name, icon_media_id, url, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, input.name, input.iconMediaId ?? null, input.url || null, next, input.isVisible === false ? 0 : 1);
  return id;
}

export function updateTool(id: string, input: { name: string; iconMediaId?: string | null; url?: string | null; isVisible?: boolean }): void {
  db.prepare("UPDATE tools SET name = ?, icon_media_id = ?, url = ?, is_visible = ? WHERE id = ?").run(
    input.name,
    input.iconMediaId ?? null,
    input.url || null,
    input.isVisible === false ? 0 : 1,
    id,
  );
}

export const deleteTool = (id: string) => void db.prepare("DELETE FROM tools WHERE id = ?").run(id);
export const reorderTools = (ids: string[]) => reorder("tools", ids);

// --- Experience -------------------------------------------------------------

export function listExperiences(opts: { visibleOnly?: boolean } = {}): Experience[] {
  const rows = db
    .prepare(
      `SELECT * FROM experiences ${opts.visibleOnly ? "WHERE is_visible = 1" : ""} ORDER BY sort_order ASC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    company: String(r.company),
    role: String(r.role ?? ""),
    workType: String(r.work_type ?? "Remote"),
    startYear: (r.start_year as number) ?? null,
    startMonth: (r.start_month as number) ?? null,
    endYear: (r.end_year as number) ?? null,
    endMonth: (r.end_month as number) ?? null,
    isCurrent: toBool(r.is_current),
    description: String(r.description ?? ""),
    sortOrder: Number(r.sort_order),
    isVisible: toBool(r.is_visible),
  }));
}

type ExperienceInput = Omit<
  Experience,
  "id" | "sortOrder" | "isVisible" | "startYear" | "startMonth" | "endYear" | "endMonth"
> & {
  startYear?: number | null;
  startMonth?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  isVisible?: boolean;
};

export function createExperience(input: ExperienceInput): string {
  const id = newId();
  db.prepare(
    `INSERT INTO experiences (id, company, role, work_type, start_year, start_month, end_year,
       end_month, is_current, description, sort_order, is_visible)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.company, input.role, input.workType,
    input.startYear ?? null, input.startMonth ?? null,
    input.isCurrent ? null : (input.endYear ?? null),
    input.isCurrent ? null : (input.endMonth ?? null),
    input.isCurrent ? 1 : 0, input.description,
    nextSortOrder("experiences"), input.isVisible === false ? 0 : 1,
  );
  return id;
}

export function updateExperience(id: string, input: ExperienceInput): void {
  db.prepare(
    `UPDATE experiences SET company = ?, role = ?, work_type = ?, start_year = ?, start_month = ?,
       end_year = ?, end_month = ?, is_current = ?, description = ?, is_visible = ? WHERE id = ?`,
  ).run(
    input.company, input.role, input.workType,
    input.startYear ?? null, input.startMonth ?? null,
    input.isCurrent ? null : (input.endYear ?? null),
    input.isCurrent ? null : (input.endMonth ?? null),
    input.isCurrent ? 1 : 0, input.description,
    input.isVisible === false ? 0 : 1, id,
  );
}

export const deleteExperience = (id: string) =>
  void db.prepare("DELETE FROM experiences WHERE id = ?").run(id);
export const reorderExperiences = (ids: string[]) => reorder("experiences", ids);

/** ABOUT-02 — auto-sort newest first, current roles at the top. */
export function autoSortExperiences(): void {
  const items = listExperiences();
  const score = (e: Experience) =>
    (e.isCurrent ? 1e9 : 0) + (e.endYear ?? e.startYear ?? 0) * 100 + (e.endMonth ?? 0);
  const ordered = [...items].sort((a, b) => score(b) - score(a));
  reorder("experiences", ordered.map((e) => e.id));
}

// --- Categories -------------------------------------------------------------

export function listCategories(opts: { visibleOnly?: boolean } = {}): Category[] {
  const rows = db
    .prepare(
      `SELECT * FROM categories ${opts.visibleOnly ? "WHERE is_visible = 1" : ""} ORDER BY sort_order ASC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    sortOrder: Number(r.sort_order),
    isVisible: toBool(r.is_visible),
  }));
}

/** Categories that have at least one published project (PRD §7.3.3 filters). */
export function listActiveCategories(): Category[] {
  const rows = db
    .prepare(
      `SELECT c.* FROM categories c
       WHERE c.is_visible = 1 AND EXISTS (
         SELECT 1 FROM project_categories pc JOIN projects p ON p.id = pc.project_id
         WHERE pc.category_id = c.id AND p.status = 'published' AND p.deleted_at IS NULL)
       ORDER BY c.sort_order ASC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    sortOrder: Number(r.sort_order),
    isVisible: toBool(r.is_visible),
  }));
}

export function createCategory(name: string, isVisible = true): string {
  const id = newId();
  db.prepare("INSERT INTO categories (id, name, slug, sort_order, is_visible) VALUES (?, ?, ?, ?, ?)").run(
    id, name, uniqueSlug("categories", slugify(name)), nextSortOrder("categories"), isVisible ? 1 : 0,
  );
  return id;
}

export function updateCategory(id: string, name: string, isVisible: boolean): void {
  db.prepare("UPDATE categories SET name = ?, is_visible = ? WHERE id = ?").run(name, isVisible ? 1 : 0, id);
}

/** Deleting a category can first move its projects elsewhere (PRD §9.3). */
export function deleteCategory(id: string, moveToId?: string | null): void {
  db.transaction(() => {
    if (moveToId) {
      const affected = db
        .prepare("SELECT project_id FROM project_categories WHERE category_id = ?")
        .all(id) as Row[];
      const link = db.prepare(
        "INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)",
      );
      for (const row of affected) link.run(row.project_id, moveToId);
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  })();
}

export const reorderCategories = (ids: string[]) => reorder("categories", ids);

// --- Shared helpers ---------------------------------------------------------

function nextSortOrder(table: string): number {
  const r = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM ${table}`).get() as Row;
  return Number(r.n);
}

function reorder(table: string, ids: string[]): void {
  const stmt = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  db.transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))();
}

export function uniqueSlug(table: string, base: string, ignoreId?: string): string {
  let candidate = base;
  let n = 1;
  for (;;) {
    const row = db
      .prepare(`SELECT id FROM ${table} WHERE slug = ?${ignoreId ? " AND id != ?" : ""}`)
      .get(...(ignoreId ? [candidate, ignoreId] : [candidate])) as Row | undefined;
    if (!row) return candidate;
    candidate = `${base}-${++n}`;
  }
}

// --- Project links / gallery rows used by the project repo ------------------

export function projectLinks(projectId: string): ProjectLink[] {
  const rows = db
    .prepare("SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order ASC")
    .all(projectId) as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    label: String(r.label),
    url: String(r.url),
    sortOrder: Number(r.sort_order),
  }));
}

export function projectGallery(projectId: string): ProjectMediaItem[] {
  const rows = db
    .prepare("SELECT * FROM project_media WHERE project_id = ? ORDER BY sort_order ASC")
    .all(projectId) as Row[];
  const media = getMediaMany(rows.map((r) => String(r.media_id)));
  return rows.map((r) => ({
    id: String(r.id),
    mediaId: String(r.media_id),
    media: media.get(String(r.media_id)) ?? null,
    sortOrder: Number(r.sort_order),
    width: (r.width as ProjectMediaItem["width"]) ?? "full",
    caption: (r.caption as string) ?? null,
  }));
}

export type { Project };
