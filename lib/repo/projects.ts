import { unstable_cache } from "next/cache";
import { sql, toBool, parseJson } from "@/lib/db";
import { getMediaMany, fetchMediaMany } from "@/lib/repo/media";
import {
  listCategories, listTools, uniqueSlug,
} from "@/lib/repo/content";
import type {
  Category, Media, MediaWidth, Project, ProjectStatus, Tool, ProjectMediaItem, ProjectLink,
} from "@/lib/types";
import type { PublishBlocker } from "@/lib/validation";

type Row = Record<string, unknown>;

/** Shapes stored in the JSONB columns (see migration 0004). */
type GalleryJson = { id: string; mediaId: string; width?: MediaWidth; caption?: string | null };
type LinkJson = { id: string; label: string; url: string };

/**
 * Columns for lists. The story, gallery and links are left out: a list of
 * fifty projects would otherwise ship every story (up to 20k characters each)
 * to the browser. `has_page` answers the only question lists ask of them.
 */
const LIST_COLUMNS = sql`
  p.id, p.title, p.slug, p.client, p.year, p.role, p.summary, p.cover_media_id,
  p.card_ratio, p.open_as, p.external_url, p.is_featured, p.featured_order, p.status,
  p.sort_order, p.published_at, p.seo_title, p.seo_description, p.og_image_id,
  p.created_at, p.updated_at, p.category_ids, p.tool_ids,
  (coalesce(btrim(p.body), '') <> ''
    or jsonb_array_length(p.gallery) > 0
    or jsonb_array_length(p.links) > 0) as has_page`;

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
    hasPage:
      r.has_page !== undefined
        ? toBool(r.has_page)
        : Boolean(String(r.body ?? "").trim()) ||
          parseJson<unknown[]>(r.gallery, []).length > 0 ||
          parseJson<unknown[]>(r.links, []).length > 0,
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

/**
 * Attaches covers, categories, tools, gallery and links.
 *
 * `detail` resolves the gallery and links too. `fresh` reads media straight
 * from the database instead of the shared cache: the dashboard must show the
 * alt text that was saved a second ago, visitors can wait for revalidation.
 */
async function hydrateMany(
  rows: Row[],
  opts: { detail?: boolean; fresh?: boolean } = {},
): Promise<Project[]> {
  if (rows.length === 0) return [];

  const mediaIds = new Set<string>();
  for (const r of rows) {
    if (r.cover_media_id) mediaIds.add(String(r.cover_media_id));
    if (opts.detail) {
      for (const item of parseJson<GalleryJson[]>(r.gallery, [])) {
        if (item.mediaId) mediaIds.add(String(item.mediaId));
      }
    }
  }

  const ids = Array.from(mediaIds);
  const [allMedia, allCats, allTools] = await Promise.all([
    opts.fresh ? fetchMediaMany(ids) : getMediaMany(ids),
    listCategories(),
    listTools(),
  ]);

  const catMap = new Map(allCats.map((c) => [c.id, c]));
  const toolMap = new Map(allTools.map((t) => [t.id, t]));

  return rows.map((r) => {
    const categories = parseJson<string[]>(r.category_ids, [])
      .map((id) => catMap.get(String(id)))
      .filter(Boolean) as Category[];
    const tools = parseJson<string[]>(r.tool_ids, [])
      .map((id) => toolMap.get(String(id)))
      .filter(Boolean) as Tool[];

    // Array order is the display order, so sortOrder is simply the position.
    const gallery: ProjectMediaItem[] = opts.detail
      ? parseJson<GalleryJson[]>(r.gallery, []).map((g, i) => ({
          id: String(g.id),
          mediaId: String(g.mediaId),
          media: allMedia.get(String(g.mediaId)) ?? null,
          sortOrder: i,
          width: g.width ?? "full",
          caption: g.caption ?? null,
        }))
      : [];

    const links: ProjectLink[] = opts.detail
      ? parseJson<LinkJson[]>(r.links, []).map((l, i) => ({
          id: String(l.id),
          label: String(l.label),
          url: String(l.url),
          sortOrder: i,
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
  hydrate: { fresh?: boolean } = {},
): Promise<{ items: Project[]; total: number }> {
  const byStatus =
    opts.status && opts.status !== "all" ? sql`and p.status = ${opts.status}` : sql``;

  // Categories are stored by id; the filter arrives as a slug.
  let byCategory = sql``;
  if (opts.categorySlug) {
    const target = (await listCategories()).find((c) => c.slug === opts.categorySlug);
    if (!target) return { items: [], total: 0 };
    byCategory = sql`and p.category_ids @> ${sql.json([target.id])}::jsonb`;
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

  // One round trip: the total rides along on every row.
  const rows = await sql<Row[]>`
    select ${LIST_COLUMNS}, count(*) over() as total_count
    from projects p
    where p.deleted_at is null ${byStatus} ${byCategory} ${bySearch} ${byFeatured}
    ${order} limit ${opts.limit ?? 500} offset ${opts.offset ?? 0}`;

  return {
    items: await hydrateMany(rows, hydrate),
    total: Number(rows[0]?.total_count ?? 0),
  };
}

const cachedListProjects = unstable_cache(
  (optsJson: string) => rawListProjects(JSON.parse(optsJson)),
  ["list-projects-v2"],
  { tags: ["site", "projects"], revalidate: 3600 },
);

/**
 * Published lists are what visitors see, so they come from the shared cache.
 * Anything else is a dashboard read and always goes to the database.
 */
export async function listProjects(
  opts: ListProjectsOptions = {},
): Promise<{ items: Project[]; total: number }> {
  if (opts.status === "published") {
    return cachedListProjects(JSON.stringify(opts));
  }
  return rawListProjects(opts, { fresh: true });
}

async function rawGetProjectBySlug(
  slug: string,
  opts: { publishedOnly?: boolean } = {},
): Promise<Project | null> {
  const onlyPublished = opts.publishedOnly ? sql`and status = 'published'` : sql``;
  const rows = await sql<Row[]>`
    select * from projects where slug = ${slug} and deleted_at is null ${onlyPublished}`;
  if (rows.length === 0) return null;
  return (await hydrateMany(rows, { detail: true, fresh: !opts.publishedOnly }))[0] ?? null;
}

const cachedGetProjectBySlug = unstable_cache(
  (slug: string) => rawGetProjectBySlug(slug, { publishedOnly: true }),
  ["project-by-slug-v2"],
  { tags: ["site", "projects"], revalidate: 3600 },
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

/** The dashboard editor's read — always fresh. */
export async function getProjectById(id: string): Promise<Project | null> {
  const rows = await sql<Row[]>`select * from projects where id = ${id}`;
  if (rows.length === 0) return null;
  return (await hydrateMany(rows, { detail: true, fresh: true }))[0] ?? null;
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

/** Live projects per category id, counted in the database. */
export async function countProjectsByCategory(): Promise<Record<string, number>> {
  const rows = await sql<Row[]>`
    select c.id, count(*)::int as n
    from projects p, jsonb_array_elements_text(p.category_ids) as c(id)
    where p.deleted_at is null
    group by c.id`;
  return Object.fromEntries(rows.map((r) => [String(r.id), Number(r.n)]));
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
  links?: { label: string; url: string }[];
};

/** Next free slot at the end of the featured row, as a SQL expression. */
const NEXT_FEATURED_ORDER = sql`
  (select coalesce(max(featured_order), 0) + 1 from projects where is_featured)`;

function cleanLinks(links: { label: string; url: string }[]): LinkJson[] {
  return links
    .filter((l) => l.label.trim() && l.url.trim())
    .map((l) => ({ id: crypto.randomUUID(), label: l.label.trim(), url: l.url.trim() }));
}

export async function createProject(input: ProjectInput): Promise<string> {
  const slug = await uniqueSlug("projects", input.slug);
  const status = input.status ?? "draft";

  // New work goes to the top of the manual order.
  const [row] = await sql<Row[]>`
    insert into projects (title, slug, client, year, role, summary, body, cover_media_id,
      card_ratio, open_as, external_url, is_featured, featured_order, status, sort_order,
      published_at, seo_title, seo_description, category_ids, tool_ids, links)
    values (${input.title}, ${slug}, ${input.client || null}, ${input.year ?? null},
      ${input.role || null}, ${input.summary || null}, ${input.body || null},
      ${input.coverMediaId || null}, ${input.cardRatio ?? "auto"}, ${input.openAs ?? "auto"},
      ${input.externalUrl || null}, ${input.isFeatured ?? false},
      ${input.isFeatured ? NEXT_FEATURED_ORDER : null}, ${status},
      (select coalesce(min(sort_order), 1) - 1 from projects),
      ${status === "published" ? new Date().toISOString() : null},
      ${input.seoTitle || null}, ${input.seoDescription || null},
      ${sql.json(input.categoryIds ?? [])}::jsonb, ${sql.json(input.toolIds ?? [])}::jsonb,
      ${sql.json(cleanLinks(input.links ?? []))}::jsonb)
    returning id`;

  return String(row.id);
}

/**
 * One UPDATE: the featured slot, publish date and status are resolved in SQL
 * against the row's current values instead of reading it first.
 */
export async function updateProject(id: string, input: ProjectInput): Promise<void> {
  const slug = await uniqueSlug("projects", input.slug, id);
  const status = input.status ?? null;

  const extra = [
    input.categoryIds ? sql`, category_ids = ${sql.json(input.categoryIds)}::jsonb` : sql``,
    input.toolIds ? sql`, tool_ids = ${sql.json(input.toolIds)}::jsonb` : sql``,
    input.links ? sql`, links = ${sql.json(cleanLinks(input.links))}::jsonb` : sql``,
  ];

  await sql`
    update projects set
      title = ${input.title},
      slug = ${slug},
      client = ${input.client || null},
      year = ${input.year ?? null},
      role = ${input.role || null},
      summary = ${input.summary || null},
      body = ${input.body || null},
      cover_media_id = ${input.coverMediaId || null},
      card_ratio = ${input.cardRatio ?? "auto"},
      open_as = ${input.openAs ?? "auto"},
      external_url = ${input.externalUrl || null},
      featured_order = ${
        input.isFeatured
          ? sql`case when is_featured and featured_order is not null
                     then featured_order else ${NEXT_FEATURED_ORDER} end`
          : null
      },
      is_featured = ${input.isFeatured ?? false},
      status = coalesce(${status}::text, status),
      published_at = case when coalesce(${status}::text, status) = 'published'
                          then coalesce(published_at, now()) else published_at end,
      seo_title = ${input.seoTitle || null},
      seo_description = ${input.seoDescription || null},
      updated_at = now()
      ${extra[0]} ${extra[1]} ${extra[2]}
    where id = ${id}`;
}

export async function setProjectStatus(id: string | string[], status: ProjectStatus): Promise<void> {
  const ids = Array.isArray(id) ? id : [id];
  if (ids.length === 0) return;
  await sql`
    update projects set status = ${status},
      published_at = case when ${status}::text = 'published' and published_at is null
                          then now() else published_at end,
      updated_at = now()
    where id in ${sql(ids)}`;
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  await sql`
    update projects set is_featured = ${featured},
      featured_order = ${featured ? NEXT_FEATURED_ORDER : null}, updated_at = now()
    where id = ${id}`;
}

export const reorderProjects = (ids: string[]) => reorderBy("sort_order", ids);
export const reorderFeatured = (ids: string[]) => reorderBy("featured_order", ids);

/** Rewrites the whole order in one statement rather than one UPDATE per row. */
async function reorderBy(column: "sort_order" | "featured_order", ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql`
    update projects p set ${sql(column)} = x.ord
    from jsonb_array_elements_text(${sql.json(ids)}::jsonb) with ordinality as x(id, ord)
    where p.id::text = x.id`;
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
// The gallery is a JSONB array on the project row. Every edit below is a
// single UPDATE addressed by project id, so nothing is read back first.

export async function addProjectMedia(
  projectId: string,
  mediaIds: string | string[],
  width: MediaWidth = "full",
): Promise<void> {
  const items: GalleryJson[] = (Array.isArray(mediaIds) ? mediaIds : [mediaIds])
    .filter(Boolean)
    .map((mediaId) => ({ id: crypto.randomUUID(), mediaId, width, caption: null }));
  if (items.length === 0) return;
  await sql`
    update projects set gallery = gallery || ${sql.json(items)}::jsonb, updated_at = now()
    where id = ${projectId}`;
}

export async function updateProjectMedia(
  projectId: string,
  id: string,
  patch: { width?: MediaWidth; caption?: string | null },
): Promise<void> {
  const changes: Partial<GalleryJson> = {};
  if (patch.width !== undefined) changes.width = patch.width;
  if (patch.caption !== undefined) changes.caption = patch.caption?.trim() || null;
  await sql`
    update projects set updated_at = now(), gallery = (
      select coalesce(jsonb_agg(
        case when g->>'id' = ${id} then g || ${sql.json(changes)}::jsonb else g end
        order by n), '[]'::jsonb)
      from jsonb_array_elements(gallery) with ordinality as t(g, n))
    where id = ${projectId}`;
}

export async function removeProjectMedia(projectId: string, id: string): Promise<void> {
  await sql`
    update projects set updated_at = now(), gallery = (
      select coalesce(jsonb_agg(g order by n), '[]'::jsonb)
      from jsonb_array_elements(gallery) with ordinality as t(g, n)
      where g->>'id' <> ${id})
    where id = ${projectId}`;
}

/** Items named in `ids` take that order; anything not named keeps its place after them. */
export async function reorderProjectMedia(projectId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql`
    update projects set updated_at = now(), gallery = (
      select coalesce(jsonb_agg(g order by coalesce(x.ord, 1000000 + t.n)), '[]'::jsonb)
      from jsonb_array_elements(gallery) with ordinality as t(g, n)
      left join jsonb_array_elements_text(${sql.json(ids)}::jsonb) with ordinality as x(id, ord)
        on x.id = t.g->>'id')
    where id = ${projectId}`;
}

// --- Publishing -------------------------------------------------------------

export type PublishCheckInput = {
  title: string;
  slug: string;
  coverMediaId?: string | null;
  categoryIds: string[];
  openAs?: Project["openAs"];
  externalUrl?: string | null;
};

function needsAlt(m: Media | null | undefined): boolean {
  return Boolean(m && m.source !== "youtube" && !m.isDecorative && !m.altText.trim());
}

/**
 * PRD §9.4 publish checklist, run against what is being saved. Media is read
 * fresh, so alt text added a moment ago in the Media Field counts.
 * Each blocker names the field and how to fix it.
 */
export async function publishBlockers(
  input: PublishCheckInput,
  projectId: string | null,
): Promise<PublishBlocker[]> {
  const [row] = projectId
    ? await sql<Row[]>`select gallery from projects where id = ${projectId}`
    : [];
  const galleryIds = parseJson<GalleryJson[]>(row?.gallery, []).map((g) => String(g.mediaId));
  const media = await fetchMediaMany([input.coverMediaId ?? "", ...galleryIds]);

  const out: PublishBlocker[] = [];
  if (!input.title.trim()) out.push({ field: "title", message: "Add a project title." });
  if (!input.slug.trim()) out.push({ field: "slug", message: "Add a URL slug." });
  if (!input.coverMediaId) out.push({ field: "cover", message: "Add a cover image or video." });

  if (input.coverMediaId && needsAlt(media.get(input.coverMediaId))) {
    out.push({
      field: "cover",
      message: "Add alt text to the cover image, or mark it as decorative.",
    });
  }
  const missingAlt = galleryIds.map((id) => media.get(id)).find(needsAlt);
  if (missingAlt) {
    out.push({
      field: "gallery",
      message: `Add alt text to “${missingAlt.title ?? "a gallery image"}”, or mark it as decorative.`,
    });
  }
  if (input.categoryIds.length === 0)
    out.push({ field: "categories", message: "Choose at least one category." });
  if (input.openAs === "external" && !input.externalUrl?.trim())
    out.push({ field: "externalUrl", message: "Add the external link this card should open." });
  return out;
}

export { listCategories, listTools };
