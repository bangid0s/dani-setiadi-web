import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  parseYouTubeUrl, fetchYouTubeOEmbed, youTubeThumbnailCandidates,
} from "@/lib/media/youtube";
import { fetchRemoteImage } from "@/lib/media/import-url";
import { detectType, processImage } from "@/lib/media/process";
import { uploadObject, newObjectPath, MEDIA_BUCKET } from "@/lib/storage";
import { insertMedia } from "@/lib/repo/media";
import sharp from "sharp";

export const runtime = "nodejs";

/** PRD §8.5 — parse, validate with oEmbed, import the thumbnail, store the ref. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const raw = body?.url?.trim();
  if (!raw) return NextResponse.json({ error: "Paste a YouTube link first." }, { status: 400 });

  const ref = parseYouTubeUrl(raw);
  if (!ref) {
    return NextResponse.json(
      {
        error: "That doesn’t look like a YouTube link.",
        hint: "Paste a link like youtube.com/watch?v=…, youtu.be/… or youtube.com/shorts/…",
      },
      { status: 400 },
    );
  }

  const oembed = await fetchYouTubeOEmbed(ref);
  if (!oembed) {
    return NextResponse.json({ error: "This video is private or unavailable." }, { status: 422 });
  }

  // Import the best available thumbnail so the card never calls YouTube.
  let storagePath: string | null = null;
  let lqip: string | null = null;
  for (const candidate of youTubeThumbnailCandidates(ref.id)) {
    try {
      const fetched = await fetchRemoteImage(candidate);
      const detected = detectType(fetched.bytes);
      if (!detected) continue;

      // sddefault/hqdefault are 4:3 with black bars — crop back to 16:9.
      const isFallback = !candidate.includes("maxresdefault");
      let bytes = fetched.bytes;
      if (isFallback) {
        const meta = await sharp(bytes).metadata();
        const w = meta.width ?? 480;
        const h = meta.height ?? 360;
        const targetH = Math.round((w / 16) * 9);
        if (targetH < h) {
          bytes = await sharp(bytes)
            .extract({ left: 0, top: Math.round((h - targetH) / 2), width: w, height: targetH })
            .toBuffer();
        }
      }
      const processed = await processImage(bytes, detected);
      storagePath = await uploadObject(
        MEDIA_BUCKET, newObjectPath(processed.mime), processed.buffer, processed.mime,
      );
      lqip = processed.lqip;
      break;
    } catch {
      // Try the next candidate; a missing thumbnail is not fatal.
    }
  }

  const media = await insertMedia({
    source: "youtube",
    originalUrl: raw,
    storagePath,
    lqip,
    youtubeId: ref.id,
    youtubeIsShort: ref.isShort,
    youtubeStart: ref.start ?? null,
    title: oembed.title,
    // §8.5 — ratio is 16:9, Shorts 9:16.
    width: ref.isShort ? 720 : 1280,
    height: ref.isShort ? 1280 : 720,
    altText: oembed.title,
  });

  return NextResponse.json({ media });
}
