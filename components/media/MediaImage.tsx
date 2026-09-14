"use client";

import Image from "next/image";
import { useState } from "react";
import type { Media } from "@/lib/types";
import { mediaSrc, isExternalSrc } from "@/lib/media/src";

/**
 * One image renderer for every source (PRD §8.1).
 *  · upload / imported link → next/image (AVIF/WebP, responsive, blur placeholder)
 *  · hotlinked link         → plain <img>, unoptimized (PRD §11.3)
 *  · SVG and GIF            → plain <img>, never re-encoded (PRD §8.3)
 *
 * MEDIA-06 — if the media fails to load, the frame keeps its size and shows a
 * `surface` block with the title. A visitor never sees a broken-image icon.
 */
export function MediaImage({
  media,
  sizes,
  priority,
  className = "",
  fallbackLabel = "Image unavailable",
  fill = true,
}: {
  media: Media | null;
  sizes: string;
  priority?: boolean;
  className?: string;
  fallbackLabel?: string;
  fill?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!media || failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-surface p-4 text-center ${className}`}
      >
        <span className="t-meta text-muted">
          {fallbackLabel}
          {media?.title ? <span className="block text-ink">{media.title}</span> : null}
        </span>
      </div>
    );
  }

  const alt = media.isDecorative ? "" : media.altText || media.title || "";
  const src = mediaSrc(media);
  if (!src) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-surface p-4 text-center ${className}`}>
        <span className="t-meta text-muted">{fallbackLabel}</span>
      </div>
    );
  }

  const objectPosition = `${media.focalX * 100}% ${media.focalY * 100}%`;
  const isVector = media.mimeType === "image/svg+xml" || media.mimeType === "image/gif";

  // External bytes and vectors bypass the optimiser; everything else goes through it.
  if (isExternalSrc(media) || isVector) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={media.width}
        height={media.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={fill ? `h-full w-full object-cover ${className}` : `w-full h-auto ${className}`}
        style={fill ? { objectPosition } : undefined}
      />
    );
  }

  if (!fill) {
    return (
      <Image
        src={src}
        alt={alt}
        width={media.width}
        height={media.height}
        sizes={sizes}
        priority={priority}
        placeholder={media.lqip ? "blur" : "empty"}
        blurDataURL={media.lqip ?? undefined}
        onError={() => setFailed(true)}
        className={`h-auto w-full ${className}`}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      placeholder={media.lqip ? "blur" : "empty"}
      blurDataURL={media.lqip ?? undefined}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      style={{ objectPosition }}
    />
  );
}
