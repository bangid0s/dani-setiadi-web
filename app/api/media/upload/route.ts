import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES, detectType, processImage, storeFile,
  FILES_DIR,
} from "@/lib/media/process";
import { insertMedia } from "@/lib/repo/media";

export const runtime = "nodejs";

/**
 * PRD §8.3 upload pipeline. Files arrive as multipart form data; the server
 * validates by signature, processes, stores, then writes the `media` row.
 *
 * Note (PRD §8.3): the spec calls for a signed direct-to-storage upload because
 * serverless request bodies are capped at ~4.5 MB. This build stores on the
 * app's own filesystem, so a direct POST is correct here — swap this route for
 * a signed-URL flow if you move storage to Supabase/S3.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 20 MB.` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = String(form?.get("kind") ?? "image");
  const detected = detectType(buffer);

  if (kind === "pdf") {
    if (detected !== "application/pdf") {
      return NextResponse.json({ error: "That file isn’t a PDF." }, { status: 415 });
    }
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "The CV must be 10 MB or smaller." }, { status: 413 });
    }
    const path = await storeFile(buffer, "application/pdf", FILES_DIR);
    return NextResponse.json({ path, filename: file.name });
  }

  if (!detected || !ACCEPTED_IMAGE_TYPES.includes(detected)) {
    return NextResponse.json(
      {
        error: `“${file.name}” isn’t a supported image. Use JPG, PNG, WebP, AVIF, GIF or SVG, up to 20 MB.`,
      },
      { status: 415 },
    );
  }
  if (kind === "svg" && detected !== "image/svg+xml") {
    return NextResponse.json({ error: "This slot takes an SVG file." }, { status: 415 });
  }

  try {
    const processed = await processImage(buffer, detected, {
      keepOriginal: String(form?.get("keepOriginal") ?? "") === "1",
    });
    const path = await storeFile(processed.buffer, processed.mime);
    const media = insertMedia({
      source: "upload",
      storagePath: path,
      title: file.name,
      mimeType: processed.mime,
      bytes: processed.buffer.length,
      width: processed.width,
      height: processed.height,
      lqip: processed.lqip,
      dominantColor: processed.dominantColor,
    });
    return NextResponse.json({ media });
  } catch {
    return NextResponse.json(
      { error: `“${file.name}” couldn’t be read. It may be corrupted — try exporting it again.` },
      { status: 422 },
    );
  }
}
