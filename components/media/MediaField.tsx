"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Media } from "@/lib/types";
import { bytesToSize } from "@/lib/format";
import { LIMITS } from "@/lib/validation";
import { mediaSrc } from "@/lib/media/src";

/* ============================================================================
   PRD §8 — one Media Field for every image slot.
   Tabs: Upload · Image URL · YouTube, plus "Choose from library".
   Per-slot allowed sources come from §8.2.
   ========================================================================== */

export type MediaSlot = {
  upload?: boolean;
  url?: boolean;
  youtube?: boolean;
  /** Restricts uploads to SVG (the greeting lettering slot). */
  svgOnly?: boolean;
};

type Tab = "upload" | "url" | "youtube" | "library";

export function MediaField({
  name,
  label,
  hint,
  required,
  initial,
  allow = { upload: true, url: true },
  multiple = false,
  onChange,
  ratioPresets = false,
  defaultRatio = "auto",
  ratioName = "cardRatio",
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  initial?: Media | null;
  allow?: MediaSlot;
  multiple?: boolean;
  onChange?: (media: Media[]) => void;
  ratioPresets?: boolean;
  defaultRatio?: string;
  ratioName?: string;
}) {
  const tabs: Tab[] = [
    ...(allow.upload ? (["upload"] as Tab[]) : []),
    ...(allow.url ? (["url"] as Tab[]) : []),
    ...(allow.youtube ? (["youtube"] as Tab[]) : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0] ?? "upload");
  const [media, setMedia] = useState<Media | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const accept = allow.svgOnly
    ? "image/svg+xml"
    : "image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml";

  const apply = useCallback(
    (items: Media[]) => {
      if (items.length === 0) return;
      setMedia(items[0]);
      setError(null);
      onChange?.(items);
    },
    [onChange],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files].slice(0, multiple ? 20 : 1);
      if (list.length === 0) return;
      setBusy(true);
      setError(null);
      const uploaded: Media[] = [];
      for (const [i, file] of list.entries()) {
        setProgress(`Uploading ${i + 1} of ${list.length}…`);
        const body = new FormData();
        body.append("file", file);
        if (allow.svgOnly) body.append("kind", "svg");
        const res = await fetch("/api/media/upload", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError({ message: data.error ?? "That upload failed.", hint: data.hint });
          break;
        }
        uploaded.push(data.media as Media);
      }
      setProgress(null);
      setBusy(false);
      apply(uploaded);
    },
    [allow.svgOnly, apply, multiple],
  );

  // Paste an image straight from the clipboard (PRD §8.3).
  useEffect(() => {
    const el = dropRef.current;
    if (!el || tab !== "upload") return;
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        void uploadFiles(files);
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [tab, uploadFiles]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="block text-[13px] font-semibold text-ink">
          {label}
          {required ? <span className="ml-0.5 text-signal">*</span> : null}
          {hint ? <span className="ml-2 font-normal text-muted">{hint}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setTab("library")}
          className="adm-link text-[13px]"
        >
          Choose from library
        </button>
      </div>

      {/* The chosen media id is what the form submits. */}
      <input type="hidden" name={name} value={media?.id ?? ""} />

      <div className="mt-2 overflow-hidden rounded-[var(--radius-admin)] border border-line-strong bg-panel">
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface/70 p-1.5">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === t ? "bg-signal text-ink" : "text-ink/85 hover:bg-panel hover:text-ink"
              }`}
            >
              {t === "upload" ? "Upload" : t === "url" ? "Image URL" : "YouTube"}
            </button>
          ))}
          {tab === "library" ? (
            <span className="rounded-[6px] bg-signal px-3 py-1.5 text-[13px] font-medium text-ink">
              Library
            </span>
          ) : null}
        </div>

        <div className="p-4">
          {error ? (
            <div
              role="alert"
              className="mb-3 rounded-[var(--radius-admin)] border border-ember/40 bg-ember/5 p-3 text-[13px]"
            >
              <p className="font-semibold text-ember">{error.message}</p>
              {error.hint ? <p className="mt-1 text-ink">{error.hint}</p> : null}
            </div>
          ) : null}

          {tab === "upload" ? (
            <UploadPane
              ref={dropRef}
              accept={accept}
              multiple={multiple}
              busy={busy}
              progress={progress}
              svgOnly={allow.svgOnly}
              onFiles={uploadFiles}
            />
          ) : null}

          {tab === "url" ? (
            <UrlPane
              busy={busy}
              setBusy={setBusy}
              onError={setError}
              onDone={apply}
              onSwitchToYouTube={() => {
                setTab("youtube");
                setError(null);
              }}
            />
          ) : null}

          {tab === "youtube" ? (
            <YouTubePane busy={busy} setBusy={setBusy} onError={setError} onDone={apply} />
          ) : null}

          {tab === "library" ? (
            <LibraryPane
              onPick={(m) => {
                apply([m]);
                setTab(tabs[0] ?? "upload");
              }}
            />
          ) : null}
        </div>
      </div>

      {media ? (
        <MediaPreview
          key={media.id}
          media={media}
          ratioPresets={ratioPresets}
          defaultRatio={defaultRatio}
          ratioName={ratioName}
          onRemove={() => {
            setMedia(null);
            onChange?.([]);
          }}
          onReplace={() => setTab(tabs[0] ?? "upload")}
        />
      ) : null}
    </div>
  );
}

// --- Panes -------------------------------------------------------------------

const UploadPane = ({
  ref,
  accept,
  multiple,
  busy,
  progress,
  svgOnly,
  onFiles,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  accept: string;
  multiple: boolean;
  busy: boolean;
  progress: string | null;
  svgOnly?: boolean;
  onFiles: (files: FileList | File[]) => void;
}) => {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={ref}
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`rounded-[var(--radius-admin)] border-2 border-dashed px-4 py-7 text-center transition-colors ${
        over ? "border-signal bg-signal-tint" : "border-line-strong"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      <p className="text-[14px] text-ink">
        Drop {multiple ? "files" : "a file"} here,{" "}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="underline decoration-signal decoration-2 underline-offset-2 hover:text-ember"
        >
          browse
        </button>
        , or paste an image (⌘V)
      </p>
      <p className="mt-1 text-[13px] text-muted">
        {svgOnly ? "SVG only" : "JPG, PNG, WebP, AVIF, GIF or SVG"} — up to 20 MB
      </p>
      {busy ? <p className="mt-3 text-[13px] font-semibold text-ink">{progress ?? "Working…"}</p> : null}
    </div>
  );
};

function UrlPane({
  busy,
  setBusy,
  onError,
  onDone,
  onSwitchToYouTube,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (e: { message: string; hint?: string } | null) => void;
  onDone: (m: Media[]) => void;
  onSwitchToYouTube: () => void;
}) {
  const [url, setUrl] = useState("");
  const [saveCopy, setSaveCopy] = useState(true);

  const fetchIt = async () => {
    if (!url.trim()) return;
    setBusy(true);
    onError(null);
    const res = await fetch("/api/media/import-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, saveCopy }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (data.switchTab === "youtube") {
        onSwitchToYouTube();
        return;
      }
      onError({ message: data.error ?? "That link couldn’t be imported.", hint: data.hint });
      return;
    }
    setUrl("");
    onDone([data.media as Media]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void fetchIt();
            }
          }}
          placeholder="https://example.com/artwork.jpg"
          className="adm-input"
        />
        <button
          type="button"
          onClick={fetchIt}
          disabled={busy}
          className="adm-btn adm-btn-primary shrink-0"
        >
          {busy ? "Fetching…" : "Fetch"}
        </button>
      </div>

      <label className="flex items-start gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={saveCopy}
          onChange={(e) => setSaveCopy(e.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
        />
        <span>
          Save a copy to my library
          {!saveCopy ? (
            <span className="mt-1 block text-ember">
              If the original site removes or moves this image, it will disappear from your
              portfolio.
            </span>
          ) : null}
        </span>
      </label>

      <p className="text-[13px] text-muted">
        Paste a direct image address. Google Drive links work if the file is shared “Anyone with
        the link”. Instagram or Behance post pages aren’t images — open the image itself and copy
        its address.
      </p>
    </div>
  );
}

function YouTubePane({
  busy,
  setBusy,
  onError,
  onDone,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (e: { message: string; hint?: string } | null) => void;
  onDone: (m: Media[]) => void;
}) {
  const [url, setUrl] = useState("");

  const add = async () => {
    if (!url.trim()) return;
    setBusy(true);
    onError(null);
    const res = await fetch("/api/media/youtube", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      onError({ message: data.error ?? "That video couldn’t be added.", hint: data.hint });
      return;
    }
    setUrl("");
    onDone([data.media as Media]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="https://youtu.be/… or https://youtube.com/shorts/…"
          className="adm-input"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="adm-btn adm-btn-primary shrink-0"
        >
          {busy ? "Checking…" : "Add"}
        </button>
      </div>
      <p className="text-[13px] text-muted">
        Watch links, youtu.be, Shorts and live links all work. Shorts become 9:16 cards; everything
        else is 16:9. The player only loads after a visitor clicks.
      </p>
    </div>
  );
}

function LibraryPane({ onPick }: { onPick: (m: Media) => void }) {
  const [items, setItems] = useState<Media[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  // Debounced search. The loading flag is set inside the timer rather than in
  // the effect body, so typing doesn't flash "Loading…" on every keystroke.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      const res = await fetch(`/api/media/library?q=${encodeURIComponent(q)}&limit=40`);
      const data = await res.json().catch(() => ({ items: [] }));
      if (!cancelled) {
        setItems(data.items ?? []);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your media…"
        className="adm-input"
      />
      {loading ? (
        <p className="mt-3 text-[13px] text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">Nothing here yet — upload or import something.</p>
      ) : (
        <ul className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-5">
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m)}
                className="block aspect-square w-full overflow-hidden rounded-[var(--radius-admin)] border border-line transition-colors hover:border-signal focus-visible:border-signal"
                title={m.title ?? ""}
              >
                <Thumb media={m} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Preview + metadata ------------------------------------------------------

const RATIOS = ["auto", "1:1", "4:5", "3:4", "2:3", "16:9", "9:16"];

function MediaPreview({
  media,
  onRemove,
  onReplace,
  ratioPresets,
  defaultRatio,
  ratioName,
}: {
  media: Media;
  onRemove: () => void;
  onReplace: () => void;
  ratioPresets: boolean;
  defaultRatio: string;
  ratioName: string;
}) {
  const [alt, setAlt] = useState(media.altText ?? "");
  const [decorative, setDecorative] = useState(media.isDecorative);
  const [focal, setFocal] = useState({ x: media.focalX, y: media.focalY });
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");

  // Metadata saves against the media record itself, so every slot using this
  // item picks the change up (PRD §8.6 "Replace keeps the same media ID").
  const persist = useCallback(
    async (patch: Partial<{ altText: string; isDecorative: boolean; focalX: number; focalY: number }>) => {
      setSaved("saving");
      const body = new FormData();
      body.append("id", media.id);
      body.append("altText", patch.altText ?? alt);
      body.append("isDecorative", (patch.isDecorative ?? decorative) ? "1" : "0");
      body.append("focalX", String(patch.focalX ?? focal.x));
      body.append("focalY", String(patch.focalY ?? focal.y));
      await fetch("/api/media/meta", { method: "POST", body });
      setSaved("done");
      setTimeout(() => setSaved("idle"), 1500);
    },
    [alt, decorative, focal, media.id],
  );

  const isYouTube = media.source === "youtube";

  return (
    <div className="mt-2.5 flex flex-col gap-4 rounded-[var(--radius-admin)] border border-line bg-card p-4 sm:flex-row">
      <div className="shrink-0">
        <button
          type="button"
          onClick={(e) => {
            if (isYouTube) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const next = {
              x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
              y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
            };
            setFocal(next);
            void persist({ focalX: next.x, focalY: next.y });
          }}
          className="relative block aspect-[4/3] w-full overflow-hidden rounded-[6px] border border-line bg-surface sm:w-40"
          title={isYouTube ? undefined : "Click to set the focal point"}
        >
          <Thumb media={media} />
          {!isYouTube ? (
            <span
              aria-hidden="true"
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream bg-signal"
              style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
            />
          ) : null}
        </button>
        {!isYouTube ? (
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted sm:w-40">Click the preview to set the focal point</p>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <p className="truncate text-[13px] text-ink">
          <span className="font-semibold">{media.title ?? "Untitled"}</span>
          <span className="ml-2 text-muted">
            {media.width} × {media.height}
            {media.bytes ? ` · ${bytesToSize(media.bytes)}` : ""}
            {media.isHotlinked ? " · hotlinked" : ""}
            {isYouTube ? ` · YouTube${media.youtubeIsShort ? " Short" : ""}` : ""}
          </span>
        </p>

        {!isYouTube ? (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label className="adm-label">
                Alt text{!decorative ? <span className="ml-0.5 text-signal">*</span> : null}
              </label>
              <span className="shrink-0 text-[12px] tabular-nums text-muted">
                {alt.length}/{LIMITS.altText.max}
              </span>
            </div>
            <input
              value={alt}
              maxLength={LIMITS.altText.max}
              disabled={decorative}
              onChange={(e) => setAlt(e.target.value)}
              onBlur={() => persist({ altText: alt })}
              placeholder="Describe the artwork for someone who can’t see it"
              className="adm-input mt-2"
            />
          </div>
        ) : null}

        {ratioPresets ? (
          <div>
            <span className="adm-label">Card ratio</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {RATIOS.map((r) => (
                <label
                  key={r}
                  className="adm-chip"
                >
                  <input
                    type="radio"
                    name={ratioName}
                    value={r}
                    defaultChecked={defaultRatio === r}
                    className="sr-only"
                  />
                  {r === "auto" ? "Auto" : r}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!isYouTube ? (
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={decorative}
                onChange={(e) => {
                  setDecorative(e.target.checked);
                  void persist({ isDecorative: e.target.checked });
                }}
                className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
              />
              Decorative image
            </label>
          ) : null}
          <button
            type="button"
            onClick={onReplace}
            className="adm-btn adm-btn-secondary"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="adm-btn adm-btn-secondary"
          >
            Remove
          </button>
          {saved !== "idle" ? (
            <span className="text-[12px] text-muted">{saved === "saving" ? "Saving…" : "Saved"}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * A media thumbnail that fills whatever box it is given. The container owns the
 * shape; the image never sets its own aspect-ratio, which is what previously
 * made these render as empty slivers.
 */
export function Thumb({ media, className = "" }: { media: Media; className?: string }) {
  const src = mediaSrc(media);
  if (!src) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center bg-surface text-[10px] leading-tight text-muted ${className}`}
      >
        No preview
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={`h-full w-full bg-surface object-cover ${className}`}
    />
  );
}
