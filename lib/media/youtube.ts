// PRD §8.5 + Appendix B — YouTube parsing, validation and the click-to-load facade.

export type YouTubeRef = { id: string; isShort: boolean; start?: number };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeUrl(input: string): YouTubeRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const [, first, second] = url.pathname.split("/");
  let id: string | null = null;
  let isShort = false;

  if (host === "youtu.be") {
    id = first ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts") {
      id = second ?? null;
      isShort = true;
    } else if (first === "embed" || first === "live" || first === "v") id = second ?? null;
  }
  if (!id || !VIDEO_ID.test(id)) return null;

  const t = url.searchParams.get("t") ?? url.searchParams.get("start");
  const start = t ? parseStartTime(t) : undefined;
  return { id, isShort, start };
}

function parseStartTime(t: string): number | undefined {
  if (/^\d+$/.test(t)) return Number(t); // "90"
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/); // "1m30s", "2h", "45s"
  if (!m || !m[0]) return undefined;
  const [, h = "0", min = "0", s = "0"] = m;
  return Number(h) * 3600 + Number(min) * 60 + Number(s);
}

export const youTubeEmbedUrl = (ref: YouTubeRef) =>
  `https://www.youtube-nocookie.com/embed/${ref.id}?autoplay=1&rel=0&playsinline=1` +
  (ref.start ? `&start=${ref.start}` : "");

export const youTubeThumbnailCandidates = (id: string) =>
  ["maxresdefault", "sddefault", "hqdefault"].map(
    (name) => `https://i.ytimg.com/vi/${id}/${name}.jpg`,
  );

export const youTubeWatchUrl = (ref: YouTubeRef) =>
  `https://www.youtube.com/watch?v=${ref.id}${ref.start ? `&t=${ref.start}` : ""}`;

/**
 * oEmbed confirms the video is available and gives us a title to prefill
 * caption / alt text (PRD §8.5). A private or removed video returns non-200.
 */
export async function fetchYouTubeOEmbed(
  ref: YouTubeRef,
): Promise<{ title: string } | null> {
  const target = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${ref.id}`,
  )}&format=json`;
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return { title: typeof data.title === "string" ? data.title : "" };
  } catch {
    return null;
  }
}
