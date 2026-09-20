import { unstable_cache } from "next/cache";
import { sql, toBool, parseJson } from "@/lib/db";
import { getMedia, getMediaMany } from "@/lib/repo/media";
import {
  listCategories, listTools, uniqueSlug,
} from "@/lib/repo/content";
import type { Category, Project, ProjectStatus, Tool, ProjectMediaItem, ProjectLink } from "@/lib/types";
import type { PublishBlocker } from "@/lib/validation";

type Row = Record<string, unknown>;

function baseProject(r: Row): Omit<Project, "cover" | "categories" | "tools" | "gallery" | "links"> {
  return {
    id: String(r.id),
    title: String(r.title),
    slug: String(r.slug),
    client: (r.client as string) ?? null,
    year: r.year === null ? null : Number(r.year),
    role: (r.role as string) ?? null,
    summary: (r.summary as string) ?? null,
    body: (r.body as string) ?? null,
    coverMediaId: (r.cover_media_id as string) ?? null,
    cardRatio: (r.card_ratio as Project["cardRatio"]) ?? "auto",
    openAs: (r.open_as as Project["openAs"]) ?? "auto",
    externalUrl: (r.external_url as string) ?? null,
    isFeatured: toBool(r.is_featured),
    featuredOrder: r.featured_order === null ? null : Number(r.featured_order),
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

/** Attaches covers, categories, tools, gallery, and links by parsing JSON arrays and in-memory caches. */
async function hydrateMany(rows: Row[], opts: { gallery?: boolean } = {}): Promise<Project[]> {
  if (rows.length === 0) return [];

  // Collect all media IDs
  const mediaIds = new Set<string>();
  for (const r of rows) {
    if (r.cover_media_id) mediaIds.add(String(r.cover_media_id));
    if (opts.gallery) {
      const g = parseJson<any[]>(r.gallery, []);
      for (const item of g) if (item.mediaId) mediaIds.add(String(item.mediaId));
    }
  }

  // Fetch all needed media in ONE query, fetch ALL categories and tools from cache (instant)
  const [allMedia, allCats, allTools] = await Promise.all([
    getMediaMany(Array.from(mediaIds)),
    listCategories(),
    listTools(),
  ]);

  const catMap = new Map(allCats.map((c) => [c.id, c]));
  const toolMap = new Map(allTools.map((t) => [t.id, t]));

  return rows.map((r) => {
    const rawCatIds = parseJson<string[]>(r.category_ids, []);
    const rawToolIds = parseJson<string[]>(r.tool_ids, []);
    const rawGallery = parseJson<any[]>(r.gallery, []);
    const rawLinks = parseJson<any[]>(r.links, []);

    const categories = rawCatIds.map((id) => catMap.get(id)).filter(Boolean) as Category[];
    const tools = rawToolIds.map((id) => toolMap.get(id)).filter(Boolean) as Tool[];
    
    const gallery: ProjectMediaItem[] = opts.gallery
      ? rawGallery.map((g) => ({
          id: String(g.id),
          mediaId: String(g.mediaId),
          media: allMedia.get(String(g.mediaId)) ?? null,
          sortOrder: 0, // Not needed anymore since array order defines sort order
          width: g.width ?? "full",
          caption: g.caption ?? null,
        }))
      : [];
      
    const links: ProjectLink[] = opts.gallery
      ? rawLinks.map((l) => ({
          id: String(l.id),
          label: String(l.label),
          url: String(l.url),
          sortOrder: 0,
        }))
      : [];

    return {
      ...baseProject(r),
      cover: r.cover_media_id ? (allMedia.get(String(r.cover_media_id)) ?? null) : null,
      categories,
      tools,
      gallery,
      links,
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

async function rawListProjects(
  opts: ListProjectsOptions = {},
): Promise<{ items: Project[]; total: number }> {
  const byStatus =
    opts.status && opts.status !== "all" ? sql`and p.status = ${opts.status}` : sql``;
    
  // category lookup uses the JSONB containment operator `@>`
  // But wait, the categories table holds the slug. We need the ID first.
  let byCategory = sql``;
  if (opts.categorySlug) {
    const allCats = await listCategories();
    const targetCat = allCats.find((c) => c.slug === opts.categorySlug);
    if (targetCat) {
      // Use JSONB containment to match the category ID inside the JSON array
      byCategory = sql`and p.category_ids @> ${sql.json([targetCat.id])}`;
    } else {
      // Category not found, return empty
      return { items: [], total: 0 };
    }
  }

  const q = opts.search?.trim() ? `%${opts.search.trim().toLowerCase()}%` : null;
  const bySearch = q
    ? sql`and (lower(p.title) like ${q} or lower(coalesce(p.client,'')) like ${q}
              or lower(coalesce(p.summary,'')) like ${q})`
    : sql``;
  const byFeatured = opts.featuredOnly
    ? sql`and p.is_featured`
    : opts.excludeFeatured
      ? sql`and not p.is_featured`
      : sql``;

  const order = opts.featuredOnly
    ? sql`order by coalesce(p.featured_order, 9999) asc, p.sort_order asc`
    : opts.sort === "newest"
      ? sql`order by coalesce(p.published_at, p.created_at) desc`
      : sql`order by p.sort_order asc, p.created_at desc`;

  const [countRow] = await sql<Row[]>`
    select count(*)::int as n from projects p
    where p.deleted_at is null ${byStatus} ${byCategory} ${bySearch} ${byFeatured}`;

  const rows = await sql<Row[]>`
    select p.* from projects p
    where p.deleted_at is null ${byStatus} ${byCategory} ${bySearch} ${byFeatured}
    ${order} limit ${opts.limit ?? 500} offset ${opts.offset ?? 0}`;

  return { items: await hydrateMany(rows), total: Number(countRow?.n ?? 0) };
}

const cachedListProjects = unstable_cache(
  (optsJson: string) => rawListProjects(JSON.parse(optsJson)),
  ["list-projects"],
  { tags: ["site", "projects"], revalidate: 3600 }
);

export async function listProjects(
  opts: ListProjectsOptions = {},
): Promise<{ items: Project[]; total: number }> {
  if (opts.status === "published") {
    return cachedListProjects(JSON.stringify(opts));
  }
  return rawListProjects(opts);
}

async function rawGetProjectBySlug(
  slug: string,
  opts: { publishedOnly?: boolean } = {},
): Promise<Project | null> {
  const onlyPublished = opts.publishedOnly ? sql`and status = 'published'` : sql``;
  const rows = await sql<Row[]>`
    select * from projects where slug = ${slug} and deleted_at is null ${onlyPublished}`;
  if (rows.length === 0) return null;
  return (await hydrateMany(rows, { gallery: true }))[0] ?? null;
}

const cachedGetProjectBySlug = unstable_cache(
  (slug: string) => rawGetProjectBySlug(slug, { publishedOnly: true }),
  ["project-by-slug"],
  { tags: ["site", "projects"], revalidate: 3600 }
);

export async function getProjectBySlug(
  slug: string,
  opts: { publishedOnly?: boolean } = {},
): Promise<Project | null> {
  if (opts.publishedOnly) {
    return cachedGetProjectBySlug(slug);
  }
  return rawGetProjectBySlug(slug, opts);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const rows = await sql<Row[]>`select * from projects where id = ${id}`;
  if (rows.length === 0) return null;
  return (await hydrateMany(rows, { gallery: true }))[0] ?? null;
}

/** PROJ-03 — previous / next follow the public gallery's sort order. */
export async function projectNeighbours(
  slug: string,
): Promise<{ prev: Project | null; next: Project | null }> {
  const { items } = await listProjects({ status: "published" });
  const i = items.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? items[i - 1] : (items.at(-1) ?? null),
    next: i < items.length - 1 ? items[i + 1] : (items[0] ?? null),
  };
}

export async function countProjects(): Promise<Record<ProjectStatus | "total", number>> {
  const rows = await sql<Row[]>`
    select status, count(*)::int as n from projects where deleted_at is null group by status`;
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

async function nextFeaturedOrder(): Promise<number> {
  const [r] = await sql<Row[]>`
    select coalesce(max(featured_order), 0) + 1 as n from projects where is_featured`;
  return Number(r.n);
}

export async function createProject(input: ProjectInput): Promise<string> {
  const slug = await uniqueSlug("projects", input.slug);
  const [minRow] = await sql<Row[]>`select coalesce(min(sort_order), 1) as n from projects`;
  
  const [row] = await sql<Row[]>`
    insert into projects (title, slug, client, year, role, summary, body, cover_media_id,
      card_ratio, open_as, external_url, is_featured, featured_order, status, sort_order,
      published_at, seo_title, seo_description, category_ids, tool_ids)
    values (${input.title}, ${slug}, ${input.client || null}, ${input.year ?? null},
      ${input.role || null}, ${input.summary || null}, ${input.body || null},
      ${input.coverMediaId || null}, ${input.cardRatio ?? "auto"}, ${input.openAs ?? "auto"},
      ${input.externalUrl || null}, ${input.isFeatured ?? false},
      ${input.isFeatured ? await nextFeaturedOrder() : null}, ${input.status ?? "draft"},
      ${Number(minRow.n) - 1},
      ${input.status === "published" ? new Date().toISOString() : null},
      ${input.seoTitle || null}, ${input.seoDescription || null},
      ${sql.json(input.categoryIds ?? [])}, ${sql.json(input.toolIds ?? [])})
    returning id`;
  
  return String(row.id);
}

export async function updateProject(id: string, input: ProjectInput): Promise<void> {
  const [current] = await sql<Row[]>`
    select status, published_at, is_featured, featured_order, slug from projects where id = ${id}`;
  const wasFeatured = toBool(current?.is_featured);
  const featuredOrder = input.isFeatured
    ? wasFeatured
      ? (current?.featured_order === null || current?.featured_order === undefined
          ? await nextFeaturedOrder()
          : Number(current.featured_order))
      : await nextFeaturedOrder()
    : null;

  const nextStatus = input.status ?? (current?.status as ProjectStatus) ?? "draft";
  const publishedAt =
    nextStatus === "published"
      ? ((current?.published_at as string) ?? new Date().toISOString())
      : ((current?.published_at as string) ?? null);

  const slug = input.slug !== current?.slug
    ? await uniqueSlug("projects", input.slug, id)
    : input.slug;

  const updates: Record<string, unknown> = {
    title: input.title,
    slug,
    client: input.client || null,
    year: input.year ?? null,
    role: input.role || null,
    summary: input.summary || null,
    body: input.body || null,
    cover_media_id: input.coverMediaId || null,
    card_ratio: input.cardRatio ?? "auto",
    open_as: input.openAs ?? "auto",
    external_url: input.externalUrl || null,
    is_featured: input.isFeatured ?? false,
    featured_order: featuredOrder,
    status: nextStatus,
    published_at: publishedAt,
    seo_title: input.seoTitle || null,
    seo_description: input.seoDescription || null,
    updated_at: new Date().toISOString()
  };

  if (input.categoryIds) updates.category_ids = sql.json(input.categoryIds);
  if (input.toolIds) updates.tool_ids = sql.json(input.toolIds);

  await sql`update projects set ${sql(updates)} where id = ${id}`;
}

export async function setProjectStatus(id: string | string[], status: ProjectStatus): Promise<void> {
  const ids = Array.isArray(id) ? id : [id];
  if (ids.length === 0) return;
  await sql`
    update projects set status = ${status},
      published_at = case when ${status} = 'published' and published_at is null
                          then now() else published_at end,
      updated_at = now()
    where id in ${sql(ids)}`;
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  await sql`
    update projects set is_featured = ${featured},
      featured_order = ${featured ? await nextFeaturedOrder() : null}, updated_at = now()
    where id = ${id}`;
}

export const reorderProjects = (ids: string[]) => reorderBy("sort_order", ids);
export const reorderFeatured = (ids: string[]) => reorderBy("featured_order", ids);

async function reorderBy(column: "sort_order" | "featured_order", ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql.begin(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx`update projects set ${tx(column)} = ${i + 1} where id = ${id}`;
    }
  });
}

export async function softDeleteProject(id: string | string[]): Promise<void> {
  const ids = Array.isArray(id) ? id : [id];
  if (ids.length === 0) return;
  await sql`update projects set deleted_at = now(), status = 'archived' where id in ${sql(ids)}`;
}

export async function restoreProject(id: string | string[]): Promise<void> {
  const ids = Array.isArray(id) ? id : [id];
  if (ids.length === 0) return;
  await sql`update projects set deleted_at = null, status = 'draft' where id in ${sql(ids)}`;
}

export async function hardDeleteProject(id: string | string[]): Promise<void> {
  const ids = Array.isArray(id) ? id : [id];
  if (ids.length === 0) return;
  await sql`delete from projects where id in ${sql(ids)}`;
}

// --- Gallery rows -----------------------------------------------------------

export async function addProjectMedia(
  projectId: string,
  mediaId: string,
  width: "full" | "half" = "full",
): Promise<string> {
  const id = crypto.randomUUID();
  await sql`
    update projects 
    set gallery = gallery || ${sql.json([{ id, mediaId, width, caption: null }])}::jsonb 
    where id = ${projectId}`;
  return id;
}

export async function updateProjectMedia(
  id: string,
  patch: { width?: "full" | "half"; caption?: string | null },
): Promise<void> {
  const [row] = await sql<Row[]>`
    select id, gallery from projects where gallery @> ${sql.json([{ id }])} limit 1`;
  if (!row) return;

  const gallery = parseJson<any[]>(row.gallery, []);
  for (const item of gallery) {
    if (item.id === id) {
      if (patch.width !== undefined) item.width = patch.width;
      if (patch.caption !== undefined) item.caption = patch.caption;
      break;
    }
  }
  await sql`update projects set gallery = ${sql.json(gallery)} where id = ${String(row.id)}`;
}

export async function removeProjectMedia(id: string): Promise<void> {
  const [row] = await sql<Row[]>`
    select id, gallery from projects where gallery @> ${sql.json([{ id }])} limit 1`;
  if (!row) return;

  const gallery = parseJson<any[]>(row.gallery, []).filter((g) => g.id !== id);
  await sql`update projects set gallery = ${sql.json(gallery)} where id = ${String(row.id)}`;
}

export async function reorderProjectMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // This expects all items belong to the same project
  const [row] = await sql<Row[]>`
    select id, gallery from projects where gallery @> ${sql.json([{ id: ids[0] }])} limit 1`;
  if (!row) return;
  
  const gallery = parseJson<any[]>(row.gallery, []);
  const map = new Map(gallery.map(g => [g.id, g]));
  
  const newGallery = [];
  for (const id of ids) {
    if (map.has(id)) {
      newGallery.push(map.get(id));
      map.delete(id);
    }
  }
  // Append any that weren't in the ids array
  for (const remaining of map.values()) {
    newGallery.push(remaining);
  }
  
  await sql`update projects set gallery = ${sql.json(newGallery)} where id = ${String(row.id)}`;
}

export async function setProjectLinks(
  projectId: string,
  links: { label: string; url: string }[],
): Promise<void> {
  const validLinks = links
    .filter(l => l.label.trim() && l.url.trim())
    .map(l => ({ id: crypto.randomUUID(), label: l.label.trim(), url: l.url.trim() }));
    
  await sql`update projects set links = ${sql.json(validLinks)} where id = ${projectId}`;
}

/** PRD §9.4 publish checklist. Each blocker names the field and how to fix it. */
export async function publishBlockers(project: Project): Promise<PublishBlocker[]> {
  const out: PublishBlocker[] = [];
  if (!project.title.trim()) out.push({ field: "title", message: "Add a project title." });
  if (!project.slug.trim()) out.push({ field: "slug", message: "Add a URL slug." });
  if (!project.coverMediaId) out.push({ field: "cover", message: "Add a cover image or video." });

  const cover = await getMedia(project.coverMediaId);
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
