import type { Media } from "@/lib/types";
import { MEDIA_BUCKET, publicUrl } from "@/lib/storage-url";

/**
 * Resolves the image URL for a media record.
 *
 * A YouTube record's `originalUrl` is a *watch page*, never an image, so it
 * must never reach an <img> src. Prefer the thumbnail we imported at save time
 * (PRD §8.5); fall back to i.ytimg.com, which is cookieless and sets no
 * tracking — the player itself still loads only after a click (WORK-07).
 */
export function mediaSrc(media: Media): string {
  if (media.source === "youtube") {
    if (media.storagePath) return publicUrl(MEDIA_BUCKET, media.storagePath);
    return media.youtubeId ? `https://i.ytimg.com/vi/${media.youtubeId}/hqdefault.jpg` : "";
  }
  if (media.isHotlinked) return media.originalUrl ?? publicUrl(MEDIA_BUCKET, media.storagePath);
  return publicUrl(MEDIA_BUCKET, media.storagePath) || (media.originalUrl ?? "");
}

/** True when the bytes are not ours, so the image optimiser must be bypassed. */
export function isExternalSrc(media: Media): boolean {
  if (media.source === "youtube") return !media.storagePath;
  return media.isHotlinked;
}
