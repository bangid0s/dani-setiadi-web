import "server-only";
import { randomBytes } from "node:crypto";
import { MEDIA_BUCKET, FILES_BUCKET, publicUrl } from "@/lib/storage-url";

/**
 * Supabase Storage, over the REST API.
 *
 * Uploads and deletes run server-side with the service role key, which never
 * reaches the browser. Reads are plain public URLs, so next/image and <img>
 * fetch them without a round trip through us.
 */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "File storage isn’t set up yet. Add SUPABASE_SERVICE_ROLE_KEY from " +
        "Supabase → Project settings → API, then restart.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageNotConfiguredError();
  return { url: url.replace(/\/$/, ""), key };
}

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/** Stored paths are bucket-relative, e.g. "2026/09/ab12cd.jpg". */
export function newObjectPath(mime: string): string {
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ext = EXTENSION[mime] ?? "bin";
  return `${folder}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
}

export async function uploadObject(
  bucket: string,
  path: string,
  body: Buffer,
  mime: string,
): Promise<string> {
  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}). ${detail.slice(0, 300)}`);
  }
  return path;
}

export async function deleteObject(bucket: string, path: string | null): Promise<void> {
  if (!path) return;
  const { url, key } = config();
  await fetch(`${url}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${key}` },
  }).catch(() => {});
}

export { MEDIA_BUCKET, FILES_BUCKET, publicUrl };
