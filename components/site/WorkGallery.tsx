"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MediaImage } from "@/components/media/MediaImage";
import { PlayIcon, ExternalLinkIcon } from "@/components/site/primitives";
import { Lightbox } from "@/components/site/Lightbox";
import { clampRatio, layoutMasonry, GAP_PX } from "@/lib/masonry";
import type { GalleryItem } from "@/components/site/gallery-types";
import { resolveOpenAs } from "@/components/site/gallery-types";
import type { Category, GallerySettings, UiLabels } from "@/lib/types";

type Props = {
  items: GalleryItem[];
  categories: Category[];
  settings: GallerySettings;
  labels: UiLabels;
  /** /work keeps filter state in the URL; the home chapter does not. */
  urlSync?: boolean;
  initialCategory?: string | null;
  pageSize: number;
  /** Home shows the first N and links to /work instead of paging. */
  seeAllHref?: string;
  seeAllLabel?: string;
};

const CAPTION_H = { mobile: 56, desktop: 62 }; // M5 — predictable caption height

export function WorkGallery({
  items,
  categories,
  settings,
  labels,
  urlSync = false,
  initialCategory = null,
  pageSize,
  seeAllHref,
  seeAllLabel,
}: Props) {
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [visible, setVisible] = useState(pageSize);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const lastPositions = useRef(new Map<string, { x: number; y: number }>());
  const triggerRef = useRef<HTMLElement | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (category ? items.filter((i) => i.categorySlugs.includes(category)) : items),
    [items, category],
  );
  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  // --- Measure the container (WORK-08: layout is computed, never guessed) ----
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(el.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const columns = useMemo(() => {
    if (width === 0) return settings.columns.desktop;
    if (width < 640) return settings.columns.mobile;
    if (width < 1024) return settings.columns.tablet;
    return settings.columns.desktop;
  }, [width, settings.columns]);

  const gap = width >= 1024 ? GAP_PX[settings.gap].desktop : GAP_PX[settings.gap].mobile;
  const captionHeight =
    settings.captionStyle === "overlay" ? 0 : width >= 1024 ? CAPTION_H.desktop : CAPTION_H.mobile;

  const layout = useMemo(
    () =>
      layoutMasonry(
        shown.map((i) => ({ id: i.id, ratio: i.ratio })),
        columns,
        width || 1200,
        gap,
        captionHeight,
      ),
    [shown, columns, width, gap, captionHeight],
  );

  const positions = useMemo(
    () => new Map(layout.positions.map((p) => [p.id, p])),
    [layout.positions],
  );

  // --- FLIP: items glide to their new positions on filter change (§5.7) -----
  useLayoutEffect(() => {
    if (width === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [id, pos] of positions) {
      const el = cardRefs.current.get(id);
      if (!el) continue;
      const prev = lastPositions.current.get(id);
      if (prev && !reduce && (prev.x !== pos.x || prev.y !== pos.y)) {
        const dx = prev.x - pos.x;
        const dy = prev.y - pos.y;
        el.animate(
          [
            { transform: `translate3d(${pos.x + dx}px, ${pos.y + dy}px, 0)` },
            { transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` },
          ],
          { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
      lastPositions.current.set(id, { x: pos.x, y: pos.y });
    }
    for (const id of [...lastPositions.current.keys()]) {
      if (!positions.has(id)) lastPositions.current.delete(id);
    }
  }, [positions, width]);

  // --- Filters ---------------------------------------------------------------
  const selectCategory = useCallback(
    (slug: string | null) => {
      setCategory(slug);
      setVisible(pageSize);
      if (urlSync) {
        const url = new URL(window.location.href);
        if (slug) url.searchParams.set("category", slug);
        else url.searchParams.delete("category");
        window.history.replaceState({}, "", url);
      }
    },
    [pageSize, urlSync],
  );

  const loadMore = useCallback(() => {
    const next = Math.min(visible + pageSize, filtered.length);
    const added = next - visible;
    setVisible(next);
    if (liveRef.current) {
      liveRef.current.textContent = `${added} more ${added === 1 ? "project" : "projects"} loaded`;
    }
  }, [visible, pageSize, filtered.length]);

  const openLightbox = useCallback((index: number, trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    // Focus returns to the originating card (WORK-06).
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const showFilters = settings.showFilters && categories.length > 1;
  // Positions exist only once the container has been measured on the client.
  const useAbsolute = width > 0;

  if (items.length === 0) {
    return (
      <p className="t-lead measure text-muted">{labels.emptyWork}</p>
    );
  }

  return (
    <>
      {showFilters ? (
        <div
          role="group"
          aria-label="Filter work by category"
          className="no-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <button
            type="button"
            className="chip"
            aria-pressed={category === null}
            onClick={() => selectCategory(null)}
          >
            {labels.allFilter}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={category === c.slug}
              onClick={() => selectCategory(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      <div ref={liveRef} aria-live="polite" className="sr-only" />

      <div
        ref={containerRef}
        className={useAbsolute ? "relative" : "grid"}
        style={
          useAbsolute
            ? { height: layout.containerHeight }
            : {
                gridTemplateColumns: `repeat(${settings.columns.desktop}, minmax(0, 1fr))`,
                gap: `${gap}px`,
              }
        }
      >
        {shown.map((item, i) => {
          const pos = positions.get(item.id);
          return (
            <GalleryCard
              key={item.id}
              item={item}
              index={i}
              labels={labels}
              defaultOpenAs={settings.defaultOpenAs}
              captionStyle={settings.captionStyle}
              onOpenLightbox={openLightbox}
              columnWidth={pos?.width ?? 0}
              absolute={useAbsolute}
              style={
                useAbsolute && pos
                  ? {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: pos.width,
                      transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                    }
                  : undefined
              }
              registerRef={(el) => {
                if (el) cardRefs.current.set(item.id, el);
                else cardRefs.current.delete(item.id);
              }}
            />
          );
        })}
      </div>

      <div className="mt-10 flex justify-center">
        {seeAllHref && filtered.length > visible ? (
          <Link href={seeAllHref} className="btn-outline">
            {seeAllLabel}
          </Link>
        ) : filtered.length > visible ? (
          <button type="button" className="btn-outline" onClick={loadMore}>
            {labels.loadMore}
          </button>
        ) : seeAllHref ? (
          <Link href={seeAllHref} className="btn-outline">
            {seeAllLabel}
          </Link>
        ) : null}
      </div>

      {lightboxIndex !== null ? (
        <Lightbox
          items={shown}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
          viewProjectLabel={labels.viewProject}
          imageUnavailableLabel={labels.imageUnavailable}
        />
      ) : null}
    </>
  );
}

// --- Card (PRD §7.3.4) -------------------------------------------------------

function GalleryCard({
  item,
  index,
  labels,
  defaultOpenAs,
  captionStyle,
  onOpenLightbox,
  columnWidth,
  absolute,
  style,
  registerRef,
}: {
  item: GalleryItem;
  index: number;
  labels: UiLabels;
  defaultOpenAs: GallerySettings["defaultOpenAs"];
  captionStyle: GallerySettings["captionStyle"];
  onOpenLightbox: (index: number, trigger: HTMLElement | null) => void;
  columnWidth: number;
  absolute: boolean;
  style?: React.CSSProperties;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const mode = resolveOpenAs(item, defaultOpenAs);
  const ratio = clampRatio(item.ratio);
  const isVideo = item.media?.source === "youtube";
  const overlay = captionStyle === "overlay";

  const sizes = absolute && columnWidth ? `${Math.ceil(columnWidth)}px` : "(max-width: 640px) 100vw, 33vw";

  const media = (
    <span className="card-media-frame relative block w-full bg-surface" style={{ aspectRatio: String(ratio) }}>
      <MediaImage
        media={item.media}
        sizes={sizes}
        fallbackLabel={labels.imageUnavailable}
      />
      {isVideo ? (
        <span
          aria-hidden="true"
          className="absolute bottom-4 left-4 flex size-14 items-center justify-center rounded-full bg-signal text-ink"
        >
          <PlayIcon className="ml-0.5 size-6" />
        </span>
      ) : null}
      {overlay ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-ink/80 to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 sm:block">
          <span className="t-card-title block truncate text-cream">{item.title}</span>
          <span className="t-meta block truncate text-cream/75">{item.categoryName}</span>
        </span>
      ) : null}
    </span>
  );

  // M5 — title clamps to one line, meta to one line, so height is predictable.
  const caption = overlay ? (
    <span className="sr-only">
      {item.title} {item.categoryName}
    </span>
  ) : (
    <span className="mt-3 block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="card-title-underline t-card-title truncate text-ink">{item.title}</span>
        {item.year ? <span className="t-label-year shrink-0 text-ink">{item.year}</span> : null}
      </span>
      <span className="t-meta mt-0.5 flex items-center gap-1 truncate text-muted">
        {item.categoryName}
        {mode === "external" ? <ExternalLinkIcon className="size-3.5" /> : null}
      </span>
    </span>
  );

  const inner = (
    <>
      {media}
      {caption}
    </>
  );

  const className = "group/card block w-full text-left";

  if (mode === "lightbox") {
    return (
      <button
        type="button"
        ref={registerRef as (el: HTMLButtonElement | null) => void}
        style={style}
        className={className}
        onClick={(e) => onOpenLightbox(index, e.currentTarget)}
        aria-label={`Open ${item.title}`}
      >
        {inner}
      </button>
    );
  }

  if (mode === "external" && item.externalUrl) {
    return (
      <a
        ref={registerRef as (el: HTMLAnchorElement | null) => void}
        style={style}
        className={className}
        href={item.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    );
  }

  return (
    <Link
      ref={registerRef as (el: HTMLAnchorElement | null) => void}
      style={style}
      className={className}
      href={`/work/${item.slug}`}
    >
      {inner}
    </Link>
  );
}
