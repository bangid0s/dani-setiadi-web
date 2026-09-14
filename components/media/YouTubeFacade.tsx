"use client";

import { useState } from "react";
import type { Media } from "@/lib/types";
import { youTubeEmbedUrl, youTubeThumbnailCandidates } from "@/lib/media/youtube";
import { PlayIcon } from "@/components/site/primitives";

/**
 * WORK-07 — no requests reach YouTube before a click. The poster is either an
 * imported thumbnail in our own storage or, as a fallback, i.ytimg.com (which
 * sets no cookies). The player is inserted only on click.
 */
export function YouTubeFacade({
  media,
  poster,
  className = "",
  title,
}: {
  media: Media;
  poster?: Media | null;
  className?: string;
  title?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbIndex, setThumbIndex] = useState(0);

  if (!media.youtubeId) return null;
  const label = title || media.title || "video";

  if (playing) {
    return (
      <iframe
        className={`h-full w-full ${className}`}
        src={youTubeEmbedUrl({
          id: media.youtubeId,
          isShort: media.youtubeIsShort,
          start: media.youtubeStart ?? undefined,
        })}
        title={label}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  // The imported thumbnail first (PRD §8.5); i.ytimg.com only as a fallback.
  const candidates = youTubeThumbnailCandidates(media.youtubeId);
  const posterSrc =
    poster?.storagePath ??
    media.storagePath ??
    candidates[Math.min(thumbIndex, candidates.length - 1)];

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className={`group/yt relative block h-full w-full bg-surface ${className}`}
      aria-label={`Play video: ${label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterSrc}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setThumbIndex((i) => i + 1)}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-4 left-4 flex size-14 items-center justify-center rounded-full bg-signal text-ink transition-transform duration-[180ms] group-hover/yt:scale-105"
      >
        <PlayIcon className="ml-0.5 size-6" />
      </span>
    </button>
  );
}
