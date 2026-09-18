"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMediaMetaAction, deleteMediaAction, type ActionState } from "@/app/admin/actions";
import { Field, Toggle, Submit, Card, FormError, FormSuccess, EmptyState } from "@/components/admin/form";
import { MediaField, Thumb } from "@/components/media/MediaField";
import { bytesToSize } from "@/lib/format";
import { LIMITS } from "@/lib/validation";
import type { Media } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

export function MediaLibrary({
  items,
  total,
  usage,
  activeSource,
  query,
}: {
  items: Media[];
  total: number;
  usage: Record<string, string[]>;
  activeSource: string;
  query: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);
  const [state, action, pending] = useActionState(saveMediaMetaAction, initial);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (key === "source" ? value : activeSource !== "all") {
      params.set("source", key === "source" ? value : activeSource);
    }
    if (key === "q" ? value : query) params.set("q", key === "q" ? value : query);
    router.push(`/admin/media${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <Card
        title="Add media"
        description={`${total} item${total === 1 ? "" : "s"} in your library. Upload files, paste an image link, or add a YouTube video.`}
        actions={
          <button
            type="button"
            onClick={() => setUploading((v) => !v)}
            className="adm-btn adm-btn-primary"
          >
            {uploading ? "Close" : "Upload or import"}
          </button>
        }
      >
        {uploading ? (
          <MediaField
            name="__library"
            label="New media"
            allow={{ upload: true, url: true, youtube: true }}
            multiple
            onChange={() => router.refresh()}
          />
        ) : (
          <p className="text-[13.5px] text-muted">
            Editing alt text on an item updates it everywhere that item is used.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <input
            type="search"
            defaultValue={query}
            placeholder="Search by name or alt text…"
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
            }}
            className="adm-input min-w-[10rem] flex-1 !text-[14px] sm:!text-[15px]"
          />
          {[
            ["all", "All"],
            ["upload", "Uploads"],
            ["youtube", "YouTube"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter("source", value === "all" ? "" : value)}
              aria-pressed={activeSource === value}
              className="adm-chip"
            >
              {label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState title="Nothing in your library yet">Upload work, paste an image link, or add a YouTube video using the panel above.</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  className={`block w-full overflow-hidden rounded-[var(--radius-admin)] border text-left transition-colors ${
                    selected?.id === m.id
                      ? "border-signal ring-2 ring-signal/25"
                      : "border-line hover:border-signal"
                  }`}
                >
                  <span className="block aspect-square overflow-hidden bg-surface">
                    <Thumb media={m} />
                  </span>
                  <span className="block truncate px-2 py-1.5 text-[12px] text-ink">
                    {m.title ?? "Untitled"}
                  </span>
                  {!m.isDecorative && m.source !== "youtube" && !m.altText ? (
                    <span className="block px-2 pb-1.5 text-[11px] text-ember">Needs alt text</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected ? (
        <Card title={selected.title ?? "Media"}>
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="w-full shrink-0 sm:w-56">
              <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-admin)] border border-line bg-surface">
                <Thumb media={selected} />
              </div>
              <p className="mt-2 text-[12px] text-muted">
                {selected.width} × {selected.height}
                {selected.bytes ? ` · ${bytesToSize(selected.bytes)}` : ""}
                <br />
                {selected.source === "upload"
                  ? "Uploaded"
                  : selected.source === "youtube"
                    ? `YouTube${selected.youtubeIsShort ? " Short" : ""}`
                    : selected.isHotlinked
                      ? "Linked (not copied)"
                      : "Imported from a link"}
              </p>
              {selected.originalUrl ? (
                <p className="mt-1 break-all text-[11px] text-muted">{selected.originalUrl}</p>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <form action={action} className="space-y-4" key={selected.id}>
                <input type="hidden" name="redirect" value="/admin/media?msg=Media+saved" />
                <input type="hidden" name="id" value={selected.id} />
                <Field label="Name" name="title" defaultValue={selected.title ?? ""} max={200} />
                <Field
                  label="Alt text"
                  name="altText"
                  multiline
                  rows={2}
                  defaultValue={selected.altText}
                  rec={LIMITS.altText.rec}
                  max={LIMITS.altText.max}
                  hint="Describe it for someone who can’t see it."
                />
                <Toggle
                  label="Decorative image (no alt text needed)"
                  name="isDecorative"
                  defaultChecked={selected.isDecorative}
                />
                <input type="hidden" name="focalX" value={selected.focalX} />
                <input type="hidden" name="focalY" value={selected.focalY} />
                <Submit pending={pending}>Save</Submit>
              </form>

              <div className="mt-5 border-t border-line pt-4">
                <p className="adm-label">Used in</p>
                {usage[selected.id]?.length ? (
                  <ul className="mt-1 space-y-0.5 text-[13px] text-muted">
                    {usage[selected.id].map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[13px] text-muted">Nothing is using this yet.</p>
                )}

                <form action={deleteMediaAction} className="mt-3">
                  <input type="hidden" name="redirect" value="/admin/media?msg=Media+deleted" />
                  <input type="hidden" name="id" value={selected.id} />
                  <button
                    type="submit"
                    className="text-[13px] font-medium text-ember underline decoration-2 underline-offset-2 hover:opacity-80"
                  >
                    Delete this item
                  </button>
                  {usage[selected.id]?.length ? (
                    <span className="ml-2 text-[12px] text-muted">
                      it’s still in use — those places will fall back to a placeholder
                    </span>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
