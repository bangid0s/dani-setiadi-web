import { db, parseJson, toBool, nowIso } from "@/lib/db";
import { newId } from "@/lib/ids";
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
    youtubeStart: (r.youtube_start as number) ?? null,
    title: (r.title as string) ?? null,
    mimeType: (r.mime_type as string) ?? null,
    bytes: (r.bytes as number) ?? null,
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

export function getMedia(id: string | null | undefined): Media | null {
  if (!id) return null;
  const row = db
    .prepare("SELECT * FROM media WHERE id = ? AND deleted_at IS NULL")
    .get(id) as Row | undefined;
  return rowToMedia(row);
}

export function getMediaMany(ids: string[]): Map<string, Media> {
  const out = new Map<string, Media>();
  if (ids.length === 0) return out;
  const unique = [...new Set(ids)];
  const placeholders = unique.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM media WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
    .all(...unique) as Row[];
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

export function listMedia(opts: ListMediaOptions = {}): { items: Media[]; total: number } {
  const where: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (opts.source && opts.source !== "all") {
    where.push("source = ?");
    params.push(opts.source);
  }
  if (opts.search?.trim()) {
    where.push("(LOWER(title) LIKE ? OR LOWER(alt_text) LIKE ? OR LOWER(original_url) LIKE ?)");
    const q = `%${opts.search.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }
  const clause = `WHERE ${where.join(" AND ")}`;
  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS n FROM media ${clause}`).get(...params) as Row).n,
  );
  const rows = db
    .prepare(`SELECT * FROM media ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, opts.limit ?? 60, opts.offset ?? 0) as Row[];
  return { items: rows.map(rowToMedia).filter(Boolean) as Media[], total };
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

export function insertMedia(input: NewMedia): Media {
  const id = newId();
  db.prepare(
    `INSERT INTO media (id, source, storage_path, original_url, is_hotlinked, youtube_id,
       youtube_is_short, youtube_start, title, mime_type, bytes, width, height, lqip,
       dominant_color, alt_text, is_decorative, poster_media_id, created_at, updated_at)
     VALUES (@id, @source, @storage_path, @original_url, @is_hotlinked, @youtube_id,
       @youtube_is_short, @youtube_start, @title, @mime_type, @bytes, @width, @height, @lqip,
       @dominant_color, @alt_text, @is_decorative, @poster_media_id, @now, @now)`,
  ).run({
    id,
    source: input.source,
    storage_path: input.storagePath ?? null,
    original_url: input.originalUrl ?? null,
    is_hotlinked: input.isHotlinked ? 1 : 0,
    youtube_id: input.youtubeId ?? null,
    youtube_is_short: input.youtubeIsShort ? 1 : 0,
    youtube_start: input.youtubeStart ?? null,
    title: input.title ?? null,
    mime_type: input.mimeType ?? null,
    bytes: input.bytes ?? null,
    width: Math.max(1, Math.round(input.width)),
    height: Math.max(1, Math.round(input.height)),
    lqip: input.lqip ?? null,
    dominant_color: input.dominantColor ?? null,
    alt_text: input.altText ?? "",
    is_decorative: input.isDecorative ? 1 : 0,
    poster_media_id: input.posterMediaId ?? null,
    now: nowIso(),
  });
  return getMedia(id)!;
}

export function updateMediaMeta(
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
): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, now: nowIso() };
  const map: Record<string, string> = {
    altText: "alt_text",
    isDecorative: "is_decorative",
    focalX: "focal_x",
    focalY: "focal_y",
    title: "title",
    posterMediaId: "poster_media_id",
    status: "status",
  };
  for (const [key, column] of Object.entries(map)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    sets.push(`${column} = @${key}`);
    params[key] = typeof value === "boolean" ? (value ? 1 : 0) : value;
  }
  if (sets.length === 0) return;
  db.prepare(`UPDATE media SET ${sets.join(", ")}, updated_at = @now WHERE id = @id`).run(params);
}

/** Soft delete, so anything still pointing at it degrades gracefully. */
export function softDeleteMedia(id: string): void {
  db.prepare("UPDATE media SET deleted_at = ? WHERE id = ?").run(nowIso(), id);
}

/** Where a media item is used — powers the "in use" warning before deleting. */
export function mediaUsage(id: string): string[] {
  const uses: string[] = [];
  const covers = db
    .prepare("SELECT title FROM projects WHERE cover_media_id = ? AND deleted_at IS NULL")
    .all(id) as Row[];
  uses.push(...covers.map((r) => `Cover of “${r.title}”`));
  const gallery = db
    .prepare(
      `SELECT p.title FROM project_media pm JOIN projects p ON p.id = pm.project_id
       WHERE pm.media_id = ? AND p.deleted_at IS NULL`,
    )
    .all(id) as Row[];
  uses.push(...gallery.map((r) => `Gallery of “${r.title}”`));
  const tools = db.prepare("SELECT name FROM tools WHERE icon_media_id = ?").all(id) as Row[];
  uses.push(...tools.map((r) => `Tool icon “${r.name}”`));
  const hero = db.prepare("SELECT content FROM sections WHERE key = 'hero'").get() as Row | undefined;
  if (hero) {
    const content = parseJson<{ portraitId?: string; greetingSvgId?: string }>(hero.content, {});
    if (content.portraitId === id) uses.push("Hero portrait");
    if (content.greetingSvgId === id) uses.push("Hero greeting lettering");
  }
  const settings = db.prepare("SELECT og_image_id, favicon_id FROM site_settings WHERE id = 1").get() as Row | undefined;
  if (settings?.og_image_id === id) uses.push("Share image");
  if (settings?.favicon_id === id) uses.push("Favicon");
  return uses;
}
