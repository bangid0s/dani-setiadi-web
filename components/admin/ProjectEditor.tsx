"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  saveProjectAction, bulkProjectAction, addProjectMediaAction,
  updateProjectMediaAction, removeProjectMediaAction, reorderProjectMediaAction,
  type ActionState,
} from "@/app/admin/actions";
import {
  Field, NumberField, Select, Toggle, Submit, Card, FormError, FormSuccess, FormGuards,
  MoveButtons,
} from "@/components/admin/form";
import { MediaField, Thumb } from "@/components/media/MediaField";
import { PageHeader } from "@/components/admin/PageHeader";
import { LIMITS } from "@/lib/validation";
import { slugify } from "@/lib/slug";
import type { Category, Media, Project, Tool } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

export function ProjectEditor({
  project,
  categories,
  tools,
}: {
  project: Project;
  categories: Category[];
  tools: Tool[];
}) {
  const [state, action, pending] = useActionState(saveProjectAction, initial);
  const [title, setTitle] = useState(project.title);
  const [slug, setSlug] = useState(project.slug);
  const [slugTouched, setSlugTouched] = useState(project.slug !== slugify(project.title));
  const [openAs, setOpenAs] = useState(project.openAs);
  const [links, setLinks] = useState(
    project.links.length ? project.links.map((l) => ({ label: l.label, url: l.url })) : [{ label: "", url: "" }],
  );

  return (
    <>
      <PageHeader
        title={project.title || "Untitled project"}
        description={
          project.status === "published"
            ? "Live on your site."
            : project.status === "draft"
              ? "Draft — not visible to visitors yet."
              : "Archived."
        }
        actions={
          <>
            {project.status === "published" ? (
              <Link
                href={`/work/${project.slug}`}
                target="_blank"
                className="adm-btn adm-btn-secondary"
              >
                View
              </Link>
            ) : null}
            <Link
              href="/admin/projects"
              className="adm-btn adm-btn-secondary"
            >
              All projects
            </Link>
          </>
        }
      />

      <form action={action} data-guard className="space-y-6" id="project-form">
        <FormGuards formId="project-form" />
        <input type="hidden" name="id" value={project.id} />
        <input type="hidden" name="status" value={project.status} />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />

        {/* 1 — Basics */}
        <Card title="Basics">
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p-title" className="text-[13px] font-semibold text-ink">
                  Title <span className="text-signal">*</span>
                </label>
                <span className="text-[12px] tabular-nums text-muted">
                  {title.length}/{LIMITS.projectTitle.max}
                </span>
              </div>
              <input
                id="p-title"
                name="title"
                value={title}
                maxLength={LIMITS.projectTitle.max}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                className="adm-input mt-2"
              />
            </div>

            <div>
              <label htmlFor="p-slug" className="text-[13px] font-semibold text-ink">
                Web address
                <span className="ml-2 font-normal text-muted">/work/{slug || "…"}</span>
              </label>
              <input
                id="p-slug"
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                onBlur={(e) => setSlug(slugify(e.target.value))}
                className="adm-input mt-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Client" name="client" defaultValue={project.client ?? ""} max={80} />
              <NumberField label="Year" name="year" min={1950} max={2100} defaultValue={project.year ?? ""} />
              <Field label="Your role" name="role" defaultValue={project.role ?? ""} max={80} />
            </div>

            <Field
              label="Summary"
              name="summary"
              multiline
              rows={3}
              defaultValue={project.summary ?? ""}
              rec={LIMITS.projectSummary.rec}
              max={LIMITS.projectSummary.max}
              hint="One or two sentences on the brief and the result."
            />

            <CheckGroup
              legend="Categories"
              name="categoryIds"
              options={categories.map((c) => ({ id: c.id, label: c.name }))}
              selected={project.categories.map((c) => c.id)}
              empty="No categories yet — add some under Categories."
            />
            <CheckGroup
              legend="Tools used"
              name="toolIds"
              options={tools.map((t) => ({ id: t.id, label: t.name }))}
              selected={project.tools.map((t) => t.id)}
              empty="No tools yet — add some under Tools."
            />
          </div>
        </Card>

        {/* 2 — Cover */}
        <Card title="Cover" description="Required to publish. This is the card visitors see in the gallery.">
          <div className="space-y-4">
            <MediaField
              name="coverMediaId"
              label="Cover media"
              required
              initial={project.cover}
              allow={{ upload: true, url: true, youtube: true }}
              ratioPresets
              defaultRatio={project.cardRatio}
              ratioName="cardRatio"
            />
            <Select
              label="When someone clicks this card"
              name="openAs"
              defaultValue={project.openAs}
              onChange={(e) => setOpenAs(e.target.value as Project["openAs"])}
              options={[
                { value: "auto", label: "Auto — lightbox if it’s a single image, otherwise the project page" },
                { value: "lightbox", label: "Open the lightbox" },
                { value: "page", label: "Open the project page" },
                { value: "external", label: "Open an external link" },
              ]}
            />
            {openAs === "external" ? (
              <Field
                label="External link"
                name="externalUrl"
                type="url"
                defaultValue={project.externalUrl ?? ""}
                hint="Opens in a new tab."
              />
            ) : (
              <input type="hidden" name="externalUrl" value={project.externalUrl ?? ""} />
            )}
          </div>
        </Card>

        {/* 4 — Story (3 is its own form below) */}
        <Card
          title="Story"
          description="Optional. Use ### for a heading, **bold**, *italic*, - for a list, > for a quote."
        >
          <Field
            label="Story"
            name="body"
            multiline
            rows={10}
            defaultValue={project.body ?? ""}
            max={20000}
          />
        </Card>

        {/* 5 — Links */}
        <Card title="Links" description="Behance, Instagram, the live site — anything worth linking.">
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                <input
                  name="linkLabel"
                  defaultValue={link.label}
                  placeholder="Label (e.g. Behance)"
                  className="adm-input min-w-32 flex-1"
                  aria-label={`Link ${i + 1} label`}
                />
                <input
                  name="linkUrl"
                  type="url"
                  defaultValue={link.url}
                  placeholder="https://…"
                  className="adm-input min-w-48 flex-[2]"
                  aria-label={`Link ${i + 1} address`}
                />
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  className="adm-btn adm-btn-secondary"
                  aria-label={`Remove link ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLinks([...links, { label: "", url: "" }])}
              className="adm-link text-[13px]"
            >
              Add another link
            </button>
          </div>
        </Card>

        {/* 6 — Visibility & SEO */}
        <Card title="Visibility and search">
          <div className="space-y-4">
            <Toggle
              label="Feature this project"
              name="isFeatured"
              defaultChecked={project.isFeatured}
              hint="Featured projects appear as large rows above the gallery (up to three)."
            />
            <Field
              label="Search-result title"
              name="seoTitle"
              defaultValue={project.seoTitle ?? ""}
              max={80}
              hint="Optional. Defaults to the project title."
            />
            <Field
              label="Search-result description"
              name="seoDescription"
              multiline
              rows={2}
              defaultValue={project.seoDescription ?? ""}
              max={300}
              hint="Optional. Defaults to the summary."
            />
          </div>
        </Card>

        <div className="adm-actionbar -mx-5 px-5 lg:-mx-10 lg:px-10">
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="adm-btn adm-btn-secondary"
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending}
            className="adm-btn adm-btn-primary"
          >
            {project.status === "published" ? "Update" : "Publish"}
          </button>
          <span className="hidden text-[13px] text-muted sm:inline">⌘S saves</span>
        </div>
      </form>

      {/* 3 — Gallery. Separate form so adding media doesn't submit the editor. */}
      <div className="mt-6 space-y-6">
        <GalleryManager project={project} />
        <DangerZone project={project} />
      </div>
    </>
  );
}

function CheckGroup({
  legend,
  name,
  options,
  selected,
  empty,
}: {
  legend: string;
  name: string;
  options: { id: string; label: string }[];
  selected: string[];
  empty: string;
}) {
  if (options.length === 0) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-ink">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.id}
            className="adm-chip"
          >
            <input
              type="checkbox"
              name={name}
              value={o.id}
              defaultChecked={selected.includes(o.id)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function GalleryManager({ project }: { project: Project }) {
  const [order, setOrder] = useState(project.gallery);
  const [pendingMedia, setPendingMedia] = useState<Media[]>([]);

  const move = (index: number, delta: number) => {
    const next = [...order];
    const t = index + delta;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t], next[index]];
    setOrder(next);
  };

  return (
    <Card
      title={`Gallery (${order.length})`}
      description="Extra images and videos shown on the project page. Full width or half width each."
    >
      <form action={addProjectMediaAction} className="mb-5">
        <input type="hidden" name="projectId" value={project.id} />
        {pendingMedia.map((m) => (
          <input key={m.id} type="hidden" name="mediaId" value={m.id} />
        ))}
        <MediaField
          name="__picker"
          label="Add to the gallery"
          allow={{ upload: true, url: true, youtube: true }}
          multiple
          onChange={setPendingMedia}
        />
        {pendingMedia.length > 0 ? (
          <div className="mt-3">
            <Submit>
              Add {pendingMedia.length} item{pendingMedia.length === 1 ? "" : "s"} to the gallery
            </Submit>
          </div>
        ) : null}
      </form>

      {order.length === 0 ? (
        <p className="text-[14px] text-muted">Nothing in the gallery yet.</p>
      ) : (
        <form action={reorderProjectMediaAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <ul className="divide-y divide-line">
            {order.map((item, i) => (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <input type="hidden" name="id" value={item.id} />
                <MoveButtons
                  label={item.media?.title ?? "item"}
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  disabledUp={i === 0}
                  disabledDown={i === order.length - 1}
                />
                <span className="block aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-[6px] border border-line bg-surface">
                  {item.media ? <Thumb media={item.media} /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">
                    {item.media?.title ?? "Missing media"}
                    {item.media?.source === "youtube" ? (
                      <span className="ml-2 text-muted">YouTube</span>
                    ) : null}
                  </p>
                  <ItemControls projectId={project.id} item={item} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Submit variant="outline">Save gallery order</Submit>
          </div>
        </form>
      )}
    </Card>
  );
}

function ItemControls({
  projectId,
  item,
}: {
  projectId: string;
  item: Project["gallery"][number];
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <form action={updateProjectMediaAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="projectId" value={projectId} />
        <select
          name="width"
          defaultValue={item.width}
          aria-label="Width"
          className="adm-input w-auto !py-1.5 !text-[13px]"
        >
          <option value="full">Full width</option>
          <option value="half">Half width</option>
        </select>
        <input
          name="caption"
          defaultValue={item.caption ?? ""}
          placeholder="Caption (optional)"
          className="adm-input min-w-40 flex-1 !py-1.5 !text-[13px]"
          aria-label="Caption"
        />
        <button
          type="submit"
          className="adm-btn adm-btn-secondary !py-1.5 !text-[13px]"
        >
          Save
        </button>
      </form>
      <form action={removeProjectMediaAction}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="projectId" value={projectId} />
        <button type="submit" className="text-[13px] font-medium text-ember underline decoration-2 underline-offset-2 hover:opacity-80">
          Remove
        </button>
      </form>
    </div>
  );
}

function DangerZone({ project }: { project: Project }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Card title="Status">
      <div className="flex flex-wrap items-center gap-2">
        <form action={bulkProjectAction}>
          <input type="hidden" name="selected" value={project.id} />
          <input
            type="hidden"
            name="redirect"
            value={`/admin/projects?msg=Project+${project.status === "published" ? "unpublished" : "published"}`}
          />
          <button
            type="submit"
            name="op"
            value={project.status === "published" ? "unpublish" : "publish"}
            className="adm-btn adm-btn-secondary"
          >
            {project.status === "published" ? "Unpublish" : "Publish now"}
          </button>
        </form>
        <form action={bulkProjectAction}>
          <input type="hidden" name="selected" value={project.id} />
          <input type="hidden" name="redirect" value="/admin/projects?msg=Project+archived" />
          <button
            type="submit"
            name="op"
            value="archive"
            className="adm-btn adm-btn-secondary"
          >
            Archive
          </button>
        </form>
        {confirming ? (
          <form action={bulkProjectAction} className="flex items-center gap-2">
            <input type="hidden" name="selected" value={project.id} />
            <input type="hidden" name="redirect" value="/admin/projects?msg=Project+deleted" />
            <span className="text-[13px] text-ink">Delete “{project.title}”?</span>
            <button
              type="submit"
              name="op"
              value="delete"
              className="adm-btn adm-btn-primary !bg-ember !text-cream"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="adm-btn adm-btn-ghost !px-2"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="adm-btn adm-btn-danger"
          >
            Delete
          </button>
        )}
      </div>
    </Card>
  );
}
