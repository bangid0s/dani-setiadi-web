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

export async function getMedia(id: string | null | undefined): Promise<Media | null> {
  if (!id) return null;
  const rows = await sql<Row[]>`
    select * from media where id = ${id} and deleted_at is null`;
  return rowToMedia(rows[0]);
}

export async function getMediaMany(ids: string[]): Promise<Map<string, Media>> {
  const out = new Map<string, Media>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const rows = await sql<Row[]>`
    select * from media where id in ${sql(unique)} and deleted_at is null`;
  for (const row of rows) {
    const m = rowToMedia(row);
    if (m) out.set(m.id, m);
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

/** Where a media item is used — powers the "in use" warning before deleting. */
export async function mediaUsage(id: string): Promise<string[]> {
  const uses: string[] = [];

  const covers = await sql<Row[]>`
    select title from projects where cover_media_id = ${id} and deleted_at is null`;
  uses.push(...covers.map((r) => `Cover of “${r.title}”`));

  const gallery = await sql<Row[]>`
    select p.title from project_media pm
    join projects p on p.id = pm.project_id
    where pm.media_id = ${id} and p.deleted_at is null`;
  uses.push(...gallery.map((r) => `Gallery of “${r.title}”`));

  const tools = await sql<Row[]>`select name from tools where icon_media_id = ${id}`;
  uses.push(...tools.map((r) => `Tool icon “${r.name}”`));

  const [hero] = await sql<Row[]>`select content from sections where key = 'hero'`;
  if (hero) {
    const content = parseJson<{ portraitId?: string; greetingSvgId?: string }>(hero.content, {});
    if (content.portraitId === id) uses.push("Hero portrait");
    if (content.greetingSvgId === id) uses.push("Hero greeting lettering");
  }

  const [settings] = await sql<Row[]>`
    select og_image_id, favicon_id from site_settings where id = 1`;
  if (settings?.og_image_id === id) uses.push("Share image");
  if (settings?.favicon_id === id) uses.push("Favicon");

  return uses;
}
