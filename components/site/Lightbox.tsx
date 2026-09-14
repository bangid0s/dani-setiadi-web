"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaImage } from "@/components/media/MediaImage";
import { YouTubeFacade } from "@/components/media/YouTubeFacade";
import { pad2 } from "@/lib/format";
import { mediaSrc } from "@/lib/media/src";
import type { GalleryItem } from "@/components/site/gallery-types";

/** PRD §7.3.5 — lightbox. Ink backdrop at 92%, media contained to 90vh × 90vw. */
export function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
  viewProjectLabel,
  imageUnavailableLabel,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
  viewProjectLabel: string;
  imageUnavailableLabel: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [playerKey, setPlayerKey] = useState(0);

  const item = items[index];
  const count = items.length;

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setPlayerKey((k) => k + 1); // tear the previous player down
      onNavigate((index + delta + count) % count);
    },
    [count, index, onNavigate],
  );

  // Keyboard: ← → navigate, Esc closes. Focus is trapped inside (PRD WORK-06).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  // Lock the page behind the dialog and move focus in.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Preload the previous and next images (PRD §7.3.5).
  useEffect(() => {
    for (const delta of [-1, 1]) {
      const neighbour = items[(index + delta + count) % count];
      const src = neighbour?.media ? mediaSrc(neighbour.media) : null;
      if (src && neighbour?.media?.source !== "youtube") {
        const img = new window.Image();
        img.src = src;
      }
    }
  }, [index, items, count]);

  if (!item) return null;
  const isVideo = item.media?.source === "youtube";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} — item ${index + 1} of ${count}`}
      ref={dialogRef}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        touchStart.current = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 -z-10 cursor-default bg-ink/92"
      />

      <div className="flex items-start justify-between gap-4 p-4 text-cream sm:p-6">
        <p className="t-index text-cream/70">
          <span className="text-cream">{pad2(index + 1)}</span>/{pad2(count)}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full border-2 border-cream/60 text-cream transition-colors hover:bg-cream hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 sm:gap-4 sm:px-4">
        {count > 1 ? (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous item"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-cream/60 text-cream transition-colors hover:bg-cream hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        ) : null}

        <div
          className="flex max-h-full min-h-0 w-full max-w-[90vw] flex-1 items-center justify-center"
          style={{ maxHeight: "90vh" }}
        >
          {isVideo && item.media ? (
            <div
              key={playerKey}
              className="w-full"
              style={{ aspectRatio: item.media.youtubeIsShort ? "9 / 16" : "16 / 9", maxHeight: "80vh", maxWidth: item.media.youtubeIsShort ? "min(90vw, 45vh)" : "90vw" }}
            >
              <YouTubeFacade media={item.media} poster={item.poster} title={item.title} />
            </div>
          ) : (
            <div className="flex max-h-[80vh] w-full items-center justify-center">
              <div
                className="relative w-full"
                style={{
                  aspectRatio: `${item.media?.width ?? 1} / ${item.media?.height ?? 1}`,
                  maxHeight: "80vh",
                  maxWidth: `min(90vw, ${(item.media?.width ?? 1) / (item.media?.height ?? 1) * 80}vh)`,
                }}
              >
                <MediaImage
                  media={item.media}
                  sizes="90vw"
                  priority
                  fallbackLabel={imageUnavailableLabel}
                  className="!object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {count > 1 ? (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next item"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-cream/60 text-cream transition-colors hover:bg-cream hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 p-4 text-cream sm:p-6">
        <div className="min-w-0">
          <p className="t-card-title text-cream">{item.title}</p>
          <p className="t-meta text-cream/70">
            {[item.categoryName, item.year].filter(Boolean).join(" · ")}
          </p>
          {item.summary ? (
            <p className="t-meta mt-1 max-w-[60ch] text-cream/80">{item.summary}</p>
          ) : null}
        </div>
        {item.hasPage ? (
          <Link
            href={`/work/${item.slug}`}
            className="shrink-0 text-cream underline decoration-signal decoration-2 underline-offset-4 hover:text-signal"
          >
            {viewProjectLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
