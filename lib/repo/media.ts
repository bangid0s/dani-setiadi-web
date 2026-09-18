import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql, parseJson, toBool } from "@/lib/db";
import type { Media } from "@/lib/types";

type Row = Record<string, unknown>;

export function rowToMedia(r: Row | undefined): Media | null {
  if (!r) return null;
  return {
    id: String(r.id),
    source: r.source as Media["source"],
    storagePath: (r.storage_path as string) ?? null,
    originalUrl: (r.original_url as string) ?? null,
    isHotlinked: toBool(r.is_hotlinked),
    youtubeId: (r.youtube_id as string) ?? null,
    youtubeIsShort: toBool(r.youtube_is_short),
    youtubeStart: r.youtube_start === null ? null : Number(r.youtube_start),
    title: (r.title as string) ?? null,
    mimeType: (r.mime_type as string) ?? null,
    bytes: r.bytes === null || r.bytes === undefined ? null : Number(r.bytes),
    width: Number(r.width) || 1,
    height: Number(r.height) || 1,
    lqip: (r.lqip as string) ?? null,
    dominantColor: (r.dominant_color as string) ?? null,
    altText: (r.alt_text as string) ?? "",
    isDecorative: toBool(r.is_decorative),
    focalX: Number(r.focal_x ?? 0.5),
    focalY: Number(r.focal_y ?? 0.5),
    posterMediaId: (r.poster_media_id as string) ?? null,
    status: (r.status as Media["status"]) ?? "ok",
    createdAt: String(r.created_at ?? ""),
  };
}

const cachedFetchMedia = unstable_cache(
  async (id: string): Promise<Media | null> => {
    const rows = await sql<Row[]>`
      select * from media where id = ${id} and deleted_at is null`;
    return rowToMedia(rows[0]);
  },
  ["media-by-id"],
  { tags: ["site", "media"], revalidate: 3600 }
);

export const getMedia = cache(async (id: string | null | undefined): Promise<Media | null> => {
  if (!id) return null;
  return cachedFetchMedia(id);
});

const cachedFetchMediaMany = unstable_cache(
  async (sortedUniqueIds: string[]): Promise<Record<string, Media>> => {
    if (sortedUniqueIds.length === 0) return {};
    const rows = await sql<Row[]>`
      select * from media where id in ${sql(sortedUniqueIds)} and deleted_at is null`;
    const out: Record<string, Media> = {};
    for (const row of rows) {
      const m = rowToMedia(row);
      if (m) out[m.id] = m;
    }
    return out;
  },
  ["media-many-by-ids"],
  { tags: ["site", "media"], revalidate: 3600 }
);

export async function getMediaMany(ids: string[]): Promise<Map<string, Media>> {
  const out = new Map<string, Media>();
  const unique = [...new Set(ids.filter(Boolean))].sort();
  if (unique.length === 0) return out;
  const records = await cachedFetchMediaMany(unique);
  for (const [id, m] of Object.entries(records)) {
    out.set(id, m);
  }
  return out;
}

export type ListMediaOptions = {
  source?: "upload" | "url" | "youtube" | "all";
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listMedia(
  opts: ListMediaOptions = {},
): Promise<{ items: Media[]; total: number }> {
  const bySource =
    opts.source && opts.source !== "all" ? sql`and source = ${opts.source}` : sql``;
  const q = opts.search?.trim() ? `%${opts.search.trim().toLowerCase()}%` : null;
  const bySearch = q
    ? sql`and (lower(coalesce(title,'')) like ${q}
              or lower(coalesce(alt_text,'')) like ${q}
              or lower(coalesce(original_url,'')) like ${q})`
    : sql``;

  const [countRow] = await sql<Row[]>`
    select count(*)::int as n from media
    where deleted_at is null ${bySource} ${bySearch}`;

  const rows = await sql<Row[]>`
    select * from media
    where deleted_at is null ${bySource} ${bySearch}
    order by created_at desc
    limit ${opts.limit ?? 60} offset ${opts.offset ?? 0}`;

  return { items: rows.map(rowToMedia).filter(Boolean) as Media[], total: Number(countRow.n) };
}

export type NewMedia = {
  source: Media["source"];
  storagePath?: string | null;
  originalUrl?: string | null;
  isHotlinked?: boolean;
  youtubeId?: string | null;
  youtubeIsShort?: boolean;
  youtubeStart?: number | null;
  title?: string | null;
  mimeType?: string | null;
  bytes?: number | null;
  width: number;
  height: number;
  lqip?: string | null;
  dominantColor?: string | null;
  altText?: string;
  isDecorative?: boolean;
  posterMediaId?: string | null;
};

export async function insertMedia(input: NewMedia): Promise<Media> {
  const rows = await sql<Row[]>`
    insert into media (
      source, storage_path, original_url, is_hotlinked, youtube_id, youtube_is_short,
      youtube_start, title, mime_type, bytes, width, height, lqip, dominant_color,
      alt_text, is_decorative, poster_media_id
    ) values (
      ${input.source}, ${input.storagePath ?? null}, ${input.originalUrl ?? null},
      ${input.isHotlinked ?? false}, ${input.youtubeId ?? null}, ${input.youtubeIsShort ?? false},
      ${input.youtubeStart ?? null}, ${input.title ?? null}, ${input.mimeType ?? null},
      ${input.bytes ?? null}, ${Math.max(1, Math.round(input.width))},
      ${Math.max(1, Math.round(input.height))}, ${input.lqip ?? null},
      ${input.dominantColor ?? null}, ${input.altText ?? ""}, ${input.isDecorative ?? false},
      ${input.posterMediaId ?? null}
    ) returning *`;
  return rowToMedia(rows[0])!;
}

export async function updateMediaMeta(
  id: string,
  patch: {
    altText?: string;
    isDecorative?: boolean;
    focalX?: number;
    focalY?: number;
    title?: string | null;
    posterMediaId?: string | null;
    status?: "ok" | "broken";
  },
): Promise<void> {
  const sets: Record<string, unknown> = {};
  if (patch.altText !== undefined) sets.alt_text = patch.altText;
  if (patch.isDecorative !== undefined) sets.is_decorative = patch.isDecorative;
  if (patch.focalX !== undefined) sets.focal_x = patch.focalX;
  if (patch.focalY !== undefined) sets.focal_y = patch.focalY;
  if (patch.title !== undefined) sets.title = patch.title;
  if (patch.posterMediaId !== undefined) sets.poster_media_id = patch.posterMediaId;
  if (patch.status !== undefined) sets.status = patch.status;
  if (Object.keys(sets).length === 0) return;
  sets.updated_at = new Date().toISOString();
  await sql`update media set ${sql(sets)} where id = ${id}`;
}

/** Soft delete, so anything still pointing at it degrades gracefully. */
export async function softDeleteMedia(id: string): Promise<void> {
  await sql`update media set deleted_at = now() where id = ${id}`;
}

/** Batched media usage lookup to prevent N+1 query storms. */
export async function mediaUsageMany(ids: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  const unique = [...new Set(ids.filter(Boolean))];
  for (const id of unique) out[id] = [];
  if (unique.length === 0) return out;

  const [covers, gallery, tools, [hero], [settings]] = await Promise.all([
    sql<Row[]>`
      select cover_media_id, title from projects
      where cover_media_id in ${sql(unique)} and deleted_at is null`,
    sql<Row[]>`
      select pm.media_id, p.title from project_media pm
      join projects p on p.id = pm.project_id
      where pm.media_id in ${sql(unique)} and p.deleted_at is null`,
    sql<Row[]>`
      select icon_media_id, name from tools
      where icon_media_id in ${sql(unique)} and deleted_at is null`,
    sql<Row[]>`select content from sections where key = 'hero'`,
    sql<Row[]>`select og_image_id, favicon_id from site_settings where id = 1`,
  ]);

  for (const r of covers) {
    const id = String(r.cover_media_id);
    if (out[id]) out[id].push(`Cover of “${r.title}”`);
  }
  for (const r of gallery) {
    const id = String(r.media_id);
    if (out[id]) out[id].push(`Gallery of “${r.title}”`);
  }
  for (const r of tools) {
    const id = String(r.icon_media_id);
    if (out[id]) out[id].push(`Tool icon “${r.name}”`);
  }
  if (hero) {
    const content = parseJson<{ portraitId?: string; greetingSvgId?: string }>(hero.content, {});
    if (content.portraitId && out[content.portraitId]) out[content.portraitId].push("Hero portrait");
    if (content.greetingSvgId && out[content.greetingSvgId]) out[content.greetingSvgId].push("Hero greeting lettering");
  }
  if (settings) {
    const ogId = settings.og_image_id as string | undefined;
    const favId = settings.favicon_id as string | undefined;
    if (ogId && out[ogId]) out[ogId].push("Share image");
    if (favId && out[favId]) out[favId].push("Favicon");
  }

  return out;
}

/** Where a single media item is used. */
export async function mediaUsage(id: string): Promise<string[]> {
  const result = await mediaUsageMany([id]);
  return result[id] ?? [];
}
