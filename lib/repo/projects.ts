import { db, toBool, nowIso } from "@/lib/db";
import { newId } from "@/lib/ids";
import { getMedia, getMediaMany } from "@/lib/repo/media";
import { projectGallery, projectLinks, listCategories, listTools, uniqueSlug } from "@/lib/repo/content";
import type { Category, Project, ProjectStatus, Tool } from "@/lib/types";
import type { PublishBlocker } from "@/lib/validation";

type Row = Record<string, unknown>;

function baseProject(r: Row): Omit<Project, "cover" | "categories" | "tools" | "gallery" | "links"> {
  return {
    id: String(r.id),
    title: String(r.title),
    slug: String(r.slug),
    client: (r.client as string) ?? null,
    year: (r.year as number) ?? null,
    role: (r.role as string) ?? null,
    summary: (r.summary as string) ?? null,
    body: (r.body as string) ?? null,
    coverMediaId: (r.cover_media_id as string) ?? null,
    cardRatio: (r.card_ratio as Project["cardRatio"]) ?? "auto",
    openAs: (r.open_as as Project["openAs"]) ?? "auto",
    externalUrl: (r.external_url as string) ?? null,
    isFeatured: toBool(r.is_featured),
    featuredOrder: (r.featured_order as number) ?? null,
    status: (r.status as ProjectStatus) ?? "draft",
    sortOrder: Number(r.sort_order ?? 0),
    publishedAt: (r.published_at as string) ?? null,
    seoTitle: (r.seo_title as string) ?? null,
    seoDescription: (r.seo_description as string) ?? null,
    ogImageId: (r.og_image_id as string) ?? null,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

/** Attaches covers, categories and tools to many rows with a fixed query count. */
function hydrateMany(rows: Row[], opts: { gallery?: boolean } = {}): Project[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const placeholders = ids.map(() => "?").join(",");

  const covers = getMediaMany(rows.map((r) => r.cover_media_id as string).filter(Boolean));

  const catRows = db
    .prepare(
      `SELECT pc.project_id, c.* FROM project_categories pc JOIN categories c ON c.id = pc.category_id
       WHERE pc.project_id IN (${placeholders}) ORDER BY c.sort_order ASC`,
    )
    .all(...ids) as Row[];
  const catsByProject = new Map<string, Category[]>();
  for (const row of catRows) {
    const list = catsByProject.get(String(row.project_id)) ?? [];
    list.push({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      sortOrder: Number(row.sort_order),
      isVisible: toBool(row.is_visible),
    });
    catsByProject.set(String(row.project_id), list);
  }

  const toolRows = db
    .prepare(
      `SELECT pt.project_id, t.* FROM project_tools pt JOIN tools t ON t.id = pt.tool_id
       WHERE pt.project_id IN (${placeholders}) ORDER BY t.sort_order ASC`,
    )
    .all(...ids) as Row[];
  const toolIcons = getMediaMany(toolRows.map((r) => r.icon_media_id as string).filter(Boolean));
  const toolsByProject = new Map<string, Tool[]>();
  for (const row of toolRows) {
    const list = toolsByProject.get(String(row.project_id)) ?? [];
    list.push({
      id: String(row.id),
      name: String(row.name),
      iconMediaId: (row.icon_media_id as string) ?? null,
      icon: row.icon_media_id ? (toolIcons.get(String(row.icon_media_id)) ?? null) : null,
      url: (row.url as string) ?? null,
      sortOrder: Number(row.sort_order),
      isVisible: toBool(row.is_visible),
    });
    toolsByProject.set(String(row.project_id), list);
  }

  return rows.map((r) => {
    const id = String(r.id);
    return {
      ...baseProject(r),
      cover: r.cover_media_id ? (covers.get(String(r.cover_media_id)) ?? null) : null,
      categories: catsByProject.get(id) ?? [],
      tools: toolsByProject.get(id) ?? [],
      gallery: opts.gallery ? projectGallery(id) : [],
      links: opts.gallery ? projectLinks(id) : [],
    };
  });
}

export type ListProjectsOptions = {
  status?: ProjectStatus | "all";
  categorySlug?: string | null;
  search?: string;
  featuredOnly?: boolean;
  excludeFeatured?: boolean;
  limit?: number;
  offset?: number;
  sort?: "manual" | "newest";
};

export function listProjects(opts: ListProjectsOptions = {}): { items: Project[]; total: number } {
  const where: string[] = ["p.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (opts.status && opts.status !== "all") {
    where.push("p.status = ?");
    params.push(opts.status);
  }
  if (opts.categorySlug) {
    where.push(
      `EXISTS (SELECT 1 FROM project_categories pc JOIN categories c ON c.id = pc.category_id
               WHERE pc.project_id = p.id AND c.slug = ?)`,
    );
    params.push(opts.categorySlug);
  }
  if (opts.search?.trim()) {
    where.push("(LOWER(p.title) LIKE ? OR LOWER(p.client) LIKE ? OR LOWER(p.summary) LIKE ?)");
    const q = `%${opts.search.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }
  if (opts.featuredOnly) where.push("p.is_featured = 1");
  if (opts.excludeFeatured) where.push("p.is_featured = 0");

  const clause = `WHERE ${where.join(" AND ")}`;
  const order = opts.featuredOnly
    ? "ORDER BY COALESCE(p.featured_order, 9999) ASC, p.sort_order ASC"
    : opts.sort === "newest"
      ? "ORDER BY COALESCE(p.published_at, p.created_at) DESC"
      : "ORDER BY p.sort_order ASC, p.created_at DESC";

  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS n FROM projects p ${clause}`).get(...params) as Row).n,
  );
  const limit = opts.limit ?? 500;
  const rows = db
    .prepare(`SELECT p.* FROM projects p ${clause} ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, opts.offset ?? 0) as Row[];

  return { items: hydrateMany(rows), total };
}

export function getProjectBySlug(slug: string, opts: { publishedOnly?: boolean } = {}): Project | null {
  const row = db
    .prepare(
      `SELECT * FROM projects WHERE slug = ? AND deleted_at IS NULL
       ${opts.publishedOnly ? "AND status = 'published'" : ""}`,
    )
    .get(slug) as Row | undefined;
  if (!row) return null;
  return hydrateMany([row], { gallery: true })[0] ?? null;
}

export function getProjectById(id: string): Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
  if (!row) return null;
  return hydrateMany([row], { gallery: true })[0] ?? null;
}

/** PROJ-03 — previous / next follow the public gallery's sort order. */
export function projectNeighbours(slug: string): { prev: Project | null; next: Project | null } {
  const { items } = listProjects({ status: "published" });
  const i = items.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? items[i - 1] : (items.at(-1) ?? null),
    next: i < items.length - 1 ? items[i + 1] : (items[0] ?? null),
  };
}

export function countProjects(): Record<ProjectStatus | "total", number> {
  const rows = db
    .prepare("SELECT status, COUNT(*) AS n FROM projects WHERE deleted_at IS NULL GROUP BY status")
    .all() as Row[];
  const out = { draft: 0, published: 0, archived: 0, total: 0 };
  for (const r of rows) {
    out[r.status as ProjectStatus] = Number(r.n);
    out.total += Number(r.n);
  }
  return out;
}

// --- Mutations --------------------------------------------------------------

export type ProjectInput = {
  title: string;
  slug: string;
  client?: string | null;
  year?: number | null;
  role?: string | null;
  summary?: string | null;
  body?: string | null;
  coverMediaId?: string | null;
  cardRatio?: Project["cardRatio"];
  openAs?: Project["openAs"];
  externalUrl?: string | null;
  isFeatured?: boolean;
  status?: ProjectStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  categoryIds?: string[];
  toolIds?: string[];
};

export function createProject(input: ProjectInput): string {
  const id = newId();
  const slug = uniqueSlug("projects", input.slug);
  const min = db.prepare("SELECT COALESCE(MIN(sort_order), 1) AS n FROM projects").get() as Row;
  db.prepare(
    `INSERT INTO projects (id, title, slug, client, year, role, summary, body, cover_media_id,
       card_ratio, open_as, external_url, is_featured, featured_order, status, sort_order,
       published_at, seo_title, seo_description, created_at, updated_at)
     VALUES (@id, @title, @slug, @client, @year, @role, @summary, @body, @cover, @ratio, @openAs,
       @externalUrl, @featured, @featuredOrder, @status, @sortOrder, @publishedAt, @seoTitle,
       @seoDescription, @now, @now)`,
  ).run({
    id,
    title: input.title,
    slug,
    client: input.client || null,
    year: input.year ?? null,
    role: input.role || null,
    summary: input.summary || null,
    body: input.body || null,
    cover: input.coverMediaId || null,
    ratio: input.cardRatio ?? "auto",
    openAs: input.openAs ?? "auto",
    externalUrl: input.externalUrl || null,
    featured: input.isFeatured ? 1 : 0,
    featuredOrder: input.isFeatured ? nextFeaturedOrder() : null,
    status: input.status ?? "draft",
    // New work goes to the front of the manual order.
    sortOrder: Number(min.n) - 1,
    publishedAt: input.status === "published" ? nowIso() : null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    now: nowIso(),
  });
  setProjectCategories(id, input.categoryIds ?? []);
  setProjectTools(id, input.toolIds ?? []);
  return id;
}

export function updateProject(id: string, input: ProjectInput): void {
  const current = db
    .prepare("SELECT status, published_at, is_featured, featured_order FROM projects WHERE id = ?")
    .get(id) as Row | undefined;
  const wasFeatured = toBool(current?.is_featured);
  // Keep an existing featured position; only newly-featured work gets a new one.
  const featuredOrder = input.isFeatured
    ? wasFeatured
      ? ((current?.featured_order as number) ?? nextFeaturedOrder())
      : nextFeaturedOrder()
    : null;
  const nextStatus = input.status ?? (current?.status as ProjectStatus) ?? "draft";
  const publishedAt =
    nextStatus === "published" ? ((current?.published_at as string) ?? nowIso()) : (current?.published_at as string) ?? null;

  db.prepare(
    `UPDATE projects SET title = @title, slug = @slug, client = @client, year = @year, role = @role,
       summary = @summary, body = @body, cover_media_id = @cover, card_ratio = @ratio,
       open_as = @openAs, external_url = @externalUrl, is_featured = @featured,
       featured_order = @featuredOrder, status = @status, published_at = @publishedAt,
       seo_title = @seoTitle, seo_description = @seoDescription, updated_at = @now
     WHERE id = @id`,
  ).run({
    id,
    title: input.title,
    slug: uniqueSlug("projects", input.slug, id),
    client: input.client || null,
    year: input.year ?? null,
    role: input.role || null,
    summary: input.summary || null,
    body: input.body || null,
    cover: input.coverMediaId || null,
    ratio: input.cardRatio ?? "auto",
    openAs: input.openAs ?? "auto",
    externalUrl: input.externalUrl || null,
    featured: input.isFeatured ? 1 : 0,
    featuredOrder,
    status: nextStatus,
    publishedAt,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    now: nowIso(),
  });
  if (input.categoryIds) setProjectCategories(id, input.categoryIds);
  if (input.toolIds) setProjectTools(id, input.toolIds);
}

function nextFeaturedOrder(): number {
  const r = db
    .prepare("SELECT COALESCE(MAX(featured_order), 0) + 1 AS n FROM projects WHERE is_featured = 1")
    .get() as Row;
  return Number(r.n);
}

export function setProjectCategories(projectId: string, categoryIds: string[]): void {
  db.transaction(() => {
    db.prepare("DELETE FROM project_categories WHERE project_id = ?").run(projectId);
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)",
    );
    for (const cid of categoryIds) stmt.run(projectId, cid);
  })();
}

export function setProjectTools(projectId: string, toolIds: string[]): void {
  db.transaction(() => {
    db.prepare("DELETE FROM project_tools WHERE project_id = ?").run(projectId);
    const stmt = db.prepare("INSERT OR IGNORE INTO project_tools (project_id, tool_id) VALUES (?, ?)");
    for (const tid of toolIds) stmt.run(projectId, tid);
  })();
}

export function setProjectStatus(id: string, status: ProjectStatus): void {
  db.prepare(
    `UPDATE projects SET status = ?, published_at = CASE WHEN ? = 'published' AND published_at IS NULL
       THEN ? ELSE published_at END, updated_at = ? WHERE id = ?`,
  ).run(status, status, nowIso(), nowIso(), id);
}

export function toggleFeatured(id: string, featured: boolean): void {
  db.prepare("UPDATE projects SET is_featured = ?, featured_order = ?, updated_at = ? WHERE id = ?").run(
    featured ? 1 : 0,
    featured ? nextFeaturedOrder() : null,
    nowIso(),
    id,
  );
}

export function reorderProjects(ids: string[]): void {
  const stmt = db.prepare("UPDATE projects SET sort_order = ? WHERE id = ?");
  db.transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))();
}

export function reorderFeatured(ids: string[]): void {
  const stmt = db.prepare("UPDATE projects SET featured_order = ? WHERE id = ?");
  db.transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))();
}

export function softDeleteProject(id: string): void {
  db.prepare("UPDATE projects SET deleted_at = ?, status = 'archived' WHERE id = ?").run(nowIso(), id);
}

export function restoreProject(id: string): void {
  db.prepare("UPDATE projects SET deleted_at = NULL, status = 'draft' WHERE id = ?").run(id);
}

export function hardDeleteProject(id: string): void {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

// --- Gallery rows -----------------------------------------------------------

export function addProjectMedia(projectId: string, mediaId: string, width: "full" | "half" = "full"): string {
  const id = newId();
  const r = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM project_media WHERE project_id = ?")
    .get(projectId) as Row;
  db.prepare(
    "INSERT INTO project_media (id, project_id, media_id, sort_order, width) VALUES (?, ?, ?, ?, ?)",
  ).run(id, projectId, mediaId, Number(r.n), width);
  return id;
}

export function updateProjectMedia(id: string, patch: { width?: "full" | "half"; caption?: string | null }): void {
  if (patch.width !== undefined)
    db.prepare("UPDATE project_media SET width = ? WHERE id = ?").run(patch.width, id);
  if (patch.caption !== undefined)
    db.prepare("UPDATE project_media SET caption = ? WHERE id = ?").run(patch.caption || null, id);
}

export const removeProjectMedia = (id: string) =>
  void db.prepare("DELETE FROM project_media WHERE id = ?").run(id);

export function reorderProjectMedia(ids: string[]): void {
  const stmt = db.prepare("UPDATE project_media SET sort_order = ? WHERE id = ?");
  db.transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))();
}

export function setProjectLinks(projectId: string, links: { label: string; url: string }[]): void {
  db.transaction(() => {
    db.prepare("DELETE FROM project_links WHERE project_id = ?").run(projectId);
    const stmt = db.prepare(
      "INSERT INTO project_links (id, project_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)",
    );
    links.forEach((l, i) => {
      if (l.label.trim() && l.url.trim()) stmt.run(newId(), projectId, l.label.trim(), l.url.trim(), i + 1);
    });
  })();
}

/**
 * PRD §9.4 publish checklist. Each blocker names the field and how to fix it.
 */
export function publishBlockers(project: Project): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (!project.title.trim()) out.push({ field: "title", message: "Add a project title." });
  if (!project.slug.trim()) out.push({ field: "slug", message: "Add a URL slug." });
  if (!project.coverMediaId) out.push({ field: "cover", message: "Add a cover image or video." });

  const cover = getMedia(project.coverMediaId);
  if (cover && cover.source !== "youtube" && !cover.isDecorative && !cover.altText.trim()) {
    out.push({
      field: "cover",
      message: "Add alt text to the cover image, or mark it as decorative.",
    });
  }
  for (const item of project.gallery) {
    const m = item.media;
    if (m && m.source !== "youtube" && !m.isDecorative && !m.altText.trim()) {
      out.push({
        field: "gallery",
        message: `Add alt text to “${m.title ?? "a gallery image"}”, or mark it as decorative.`,
      });
      break;
    }
  }
  if (project.categories.length === 0)
    out.push({ field: "categories", message: "Choose at least one category." });
  if (project.openAs === "external" && !project.externalUrl?.trim())
    out.push({ field: "externalUrl", message: "Add the external link this card should open." });
  return out;
}

export { listCategories, listTools };
