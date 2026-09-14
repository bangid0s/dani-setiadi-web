/**
 * Public URLs for stored objects. Isomorphic on purpose: client components
 * render media too, and this only needs NEXT_PUBLIC_SUPABASE_URL.
 */
export const MEDIA_BUCKET = "media";
export const FILES_BUCKET = "files";

export function publicUrl(bucket: string, path: string | null | undefined): string {
  if (!path) return "";
  // Absolute URLs and legacy filesystem paths pass straight through, so rows
  // written before the move to Supabase Storage keep working.
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
