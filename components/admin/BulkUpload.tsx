"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Card } from "@/components/admin/form";
import type { Category, Media } from "@/lib/types";

/**
 * PRD §9.3 Bulk upload — drop many files, then either one draft project per
 * file (titles from the file names) or all of them into one project's gallery.
 */
export function BulkUpload({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"per-file" | "single">("per-file");
  const [categoryId, setCategoryId] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const run = async () => {
    if (files.length === 0) return;
    setError(null);
    const uploaded: Media[] = [];
    // §8.3 — up to 3 files upload in parallel.
    for (let i = 0; i < files.length; i += 3) {
      const batch = files.slice(i, i + 3);
      setProgress(`Uploading ${Math.min(i + batch.length, files.length)} of ${files.length}…`);
      const results = await Promise.all(
        batch.map(async (file) => {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch("/api/media/upload", { method: "POST", body });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? `“${file.name}” failed to upload.`);
          return data.media as Media;
        }),
      ).catch((e: Error) => {
        setError(e.message);
        return null;
      });
      if (!results) {
        setProgress(null);
        return;
      }
      uploaded.push(...results);
    }

    setProgress("Creating projects…");
    const res = await fetch("/api/projects/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        categoryId: categoryId || null,
        items: uploaded.map((m) => ({ mediaId: m.id, title: titleFromFilename(m.title ?? "") })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setProgress(null);
    if (!res.ok) {
      setError(data.error ?? "Those files uploaded, but the projects couldn’t be created.");
      return;
    }
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    if (data.projectId) router.push(`/admin/projects/${data.projectId}`);
    else router.refresh();
  };

  return (
    <Card
      title="Bulk upload"
      description="Drop a folder of work here and turn it into projects in one go."
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          setFiles([...e.dataTransfer.files]);
        }}
        className={`rounded-[var(--radius-admin)] border-2 border-dashed p-6 text-center transition-colors ${
          over ? "border-signal bg-signal-tint" : "border-line"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
          className="sr-only"
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
        />
        <p className="text-[14px] text-ink">
          Drop files here or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="underline decoration-signal decoration-2 underline-offset-2 hover:text-ember"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"} ready` : "Up to 20 MB each"}
        </p>
      </div>

      {files.length > 0 ? (
        <div className="mt-4 space-y-3">
          <fieldset>
            <legend className="text-[13px] font-semibold text-ink">What should happen?</legend>
            <div className="mt-1.5 space-y-1.5">
              <label className="flex items-center gap-2 text-[14px] text-ink">
                <input
                  type="radio"
                  checked={mode === "per-file"}
                  onChange={() => setMode("per-file")}
                  className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
                />
                One draft project per file (titles come from the file names)
              </label>
              <label className="flex items-center gap-2 text-[14px] text-ink">
                <input
                  type="radio"
                  checked={mode === "single"}
                  onChange={() => setMode("single")}
                  className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
                />
                Add them all to one new project’s gallery
              </label>
            </div>
          </fieldset>

          <label className="block">
            <span className="text-[13px] font-semibold text-ink">Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="adm-input mt-2"
            >
              <option value="">Choose later</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className="text-[13px] text-ember">{error}</p> : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={Boolean(progress)}
              className="adm-btn adm-btn-primary"
            >
              {progress ?? `Upload ${files.length} file${files.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setFiles([]);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="adm-btn adm-btn-ghost !px-2"
            >
              Clear
            </button>
          </div>
          <p className="text-[13px] text-muted">
            Everything arrives as a draft — nothing is public until you publish it.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

function titleFromFilename(name: string): string {
  return (
    name
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase())
      .slice(0, 60) || "Untitled project"
  );
}
