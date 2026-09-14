import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchRemoteImage, ImportError } from "@/lib/media/import-url";
import { detectType, ACCEPTED_IMAGE_TYPES, processImage } from "@/lib/media/process";
import { uploadObject, newObjectPath, MEDIA_BUCKET } from "@/lib/storage";
import { insertMedia } from "@/lib/repo/media";
import { parseYouTubeUrl } from "@/lib/media/youtube";

export const runtime = "nodejs";

/** PRD §8.4 — Image URL import, SSRF-guarded, with "save a copy" on by default. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { url?: string; saveCopy?: boolean }
    | null;
  const url = body?.url?.trim();
  if (!url) return NextResponse.json({ error: "Paste an image address first." }, { status: 400 });

  // A YouTube link pasted here belongs on the YouTube tab (PRD §8.4).
  if (parseYouTubeUrl(url)) {
    return NextResponse.json({ error: "youtube", switchTab: "youtube" }, { status: 400 });
  }

  const saveCopy = body?.saveCopy !== false;

  try {
    const fetched = await fetchRemoteImage(url);
    const detected = detectType(fetched.bytes);
    if (!detected || !ACCEPTED_IMAGE_TYPES.includes(detected)) {
      return NextResponse.json(
        {
          error: "That link returns a file we can’t read as an image.",
          hint: "Use a direct JPG, PNG, WebP, AVIF, GIF or SVG address.",
        },
        { status: 415 },
      );
    }

    const processed = await processImage(fetched.bytes, detected);

    if (!saveCopy) {
      // Hotlinked: we keep the dimensions so layout is still shift-free.
      const media = await insertMedia({
        source: "url",
        originalUrl: fetched.finalUrl,
        isHotlinked: true,
        title: filenameFromUrl(fetched.finalUrl),
        mimeType: detected,
        width: processed.width,
        height: processed.height,
        lqip: processed.lqip,
        dominantColor: processed.dominantColor,
      });
      return NextResponse.json({ media });
    }

    const objectPath = await uploadObject(
      MEDIA_BUCKET, newObjectPath(processed.mime), processed.buffer, processed.mime,
    );
    const media = await insertMedia({
      source: "url",
      storagePath: objectPath,
      originalUrl: fetched.finalUrl,
      isHotlinked: false,
      title: filenameFromUrl(fetched.finalUrl),
      mimeType: processed.mime,
      bytes: processed.buffer.length,
      width: processed.width,
      height: processed.height,
      lqip: processed.lqip,
      dominantColor: processed.dominantColor,
    });
    return NextResponse.json({ media });
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message, hint: err.hint }, { status: 422 });
    }
    return NextResponse.json(
      { error: "That link couldn’t be imported. Try again, or upload the file instead." },
      { status: 500 },
    );
  }
}

function filenameFromUrl(url: string): string {
  try {
    const name = new URL(url).pathname.split("/").filter(Boolean).pop();
    return name ? decodeURIComponent(name).slice(0, 120) : "Imported image";
  } catch {
    return "Imported image";
  }
}
