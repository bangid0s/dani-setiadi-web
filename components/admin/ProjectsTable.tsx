"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  bulkProjectAction, reorderProjectsAction, toggleFeaturedAction,
} from "@/app/admin/actions";
import { Submit, Card, MoveButtons, StatusBadge, EmptyState } from "@/components/admin/form";
import { Thumb } from "@/components/media/MediaField";
import type { Category, Project } from "@/lib/types";

export function ProjectsTable({
  projects,
  categories,
  activeStatus,
  activeCategory,
  query,
}: {
  projects: Project[];
  categories: Category[];
  activeStatus: string;
  activeCategory: string;
  query: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [order, setOrder] = useState(projects);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // After an action (star, publish, delete…) the server sends a fresh list;
  // adopt it, or the rows on screen would keep showing the old state.
  const [synced, setSynced] = useState(projects);
  if (projects !== synced) {
    setSynced(projects);
    setOrder(projects);
    setSelected(new Set());
  }

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/projects?${next.toString()}`);
  };

  const move = (index: number, delta: number) => {
    const next = [...order];
    const t = index + delta;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t], next[index]];
    setOrder(next);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const featured = order.filter((p) => p.isFeatured);
  const filtersActive = Boolean(query || activeCategory || activeStatus !== "all");

  return (
    <div className="space-y-5">
      <Card>
        {/* Filters: search takes the row on mobile, the two selects share the
            next one, so nothing stacks into a tall column of controls. */}
        <div className="mb-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            type="search"
            defaultValue={query}
            placeholder="Search projects…"
            aria-label="Search projects"
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
            }}
            className="adm-input sm:col-span-1"
          />
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select
              value={activeStatus === "all" ? "" : activeStatus}
              onChange={(e) => setParam("status", e.target.value)}
              aria-label="Filter by status"
              className="adm-input min-w-0 !text-[14px] sm:w-40 sm:!text-[15px]"
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={activeCategory}
              onChange={(e) => setParam("category", e.target.value)}
              aria-label="Filter by category"
              className="adm-input min-w-0 !text-[14px] sm:w-48 sm:!text-[15px]"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {order.length === 0 ? (
          <EmptyState
            title={filtersActive ? "Nothing matches those filters" : "No projects yet"}
            action={
              filtersActive ? (
                <button
                  type="button"
                  onClick={() => router.push("/admin/projects")}
                  className="adm-btn adm-btn-secondary"
                >
                  Clear filters
                </button>
              ) : null
            }
          >
            {filtersActive
              ? "Try a different search, status or category."
              : "Use “New project” above, or drop a folder of files into Bulk upload below."}
          </EmptyState>
        ) : (
          <form action={reorderProjectsAction}>
            <ul className="divide-y divide-line border-y border-line">
              {order.map((p, i) => (
                <li key={p.id} className="py-3">
                  <input type="hidden" name="id" value={p.id} />
                  {/* Two rows on a phone, one on a laptop — the title never
                      gets squeezed into an ellipsis. */}
                  <div className="grid grid-cols-[auto_auto_3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_auto_3.5rem_minmax(0,1fr)_auto]">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.title}`}
                      className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
                    />
                    <MoveButtons
                      label={p.title}
                      onUp={() => move(i, -1)}
                      onDown={() => move(i, 1)}
                      disabledUp={i === 0}
                      disabledDown={i === order.length - 1}
                    />
                    <span className="block aspect-[4/3] w-14 overflow-hidden rounded-[6px] border border-line bg-surface">
                      {p.cover ? <Thumb media={p.cover} sizes="56px" /> : null}
                    </span>

                    <span className="min-w-0">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="block truncate text-[14.5px] font-semibold text-ink hover:text-ember"
                      >
                        {p.title}
                      </Link>
                      <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                        {p.categories.map((c) => c.name).join(", ") || "No category"}
                        {p.year ? ` · ${p.year}` : ""}
                        {p.isFeatured ? " · Featured" : ""}
                      </span>
                    </span>

                    <span className="col-start-4 flex items-center gap-2 sm:col-start-5">
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Submit variant="outline">Save order</Submit>
            </div>
          </form>
        )}
      </Card>

      {order.length > 0 ? (
        <Card
          title="Featured"
          description="Up to three projects run as large rows above the gallery. Tap a name to add or remove it."
          actions={
            <span className="adm-badge" data-tone={featured.length ? "live" : undefined}>
              {featured.length}/3
            </span>
          }
        >
          <ul className="flex flex-wrap gap-2">
            {order.map((p) => (
              <li key={p.id}>
                <form action={toggleFeaturedAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="featured" value={p.isFeatured ? "0" : "1"} />
                  <button
                    type="submit"
                    disabled={!p.isFeatured && featured.length >= 3}
                    aria-pressed={p.isFeatured}
                    className="adm-chip max-w-full disabled:opacity-40"
                  >
                    <span aria-hidden="true" className={p.isFeatured ? "text-ink" : "text-muted"}>
                      {p.isFeatured ? "★" : "☆"}
                    </span>
                    <span className="truncate">{p.title}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {selected.size > 0 ? (
        <form action={bulkProjectAction} className="adm-actionbar -mx-5 px-5 lg:-mx-10 lg:px-10">
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="selected" value={id} />
          ))}
          <span className="text-[13.5px] font-semibold text-ink">
            {selected.size} selected
          </span>
          <span className="flex flex-wrap gap-2">
            {[
              ["publish", "Publish"],
              ["unpublish", "Unpublish"],
              ["archive", "Archive"],
            ].map(([op, label]) => (
              <button key={op} type="submit" name="op" value={op} className="adm-btn adm-btn-secondary">
                {label}
              </button>
            ))}
            <button type="submit" name="op" value="delete" className="adm-btn adm-btn-danger">
              Delete
            </button>
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="adm-btn adm-btn-ghost ml-auto"
          >
            Clear
          </button>
        </form>
      ) : null}
    </div>
  );
}
