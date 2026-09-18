import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql, parseJson, toBool } from "@/lib/db";
import { slugify } from "@/lib/ids";
import { getMedia, getMediaMany } from "@/lib/repo/media";
import {
  parseSectionContent, availabilitySchema, gallerySettingsSchema, uiLabelsSchema,
} from "@/lib/validation";
import type {
  AboutContent, Availability, Category, ContactContent, Experience, GallerySettings,
  HeroContent, Project, ProjectLink, ProjectMediaItem, Section, SectionKey, SiteSettings,
  SocialLink, Tool, UiLabels, WorkContent,
} from "@/lib/types";

type Row = Record<string, unknown>;

// --- Sections ---------------------------------------------------------------

/**
 * Reads are wrapped in React's `cache()`, which de-duplicates identical calls
 * within a single request. Without it a page that asks for the settings in the
 * layout, in generateMetadata and again in the component pays for three round
 * trips to the database instead of one.
 */
const cachedFetchSections = unstable_cache(
  async (): Promise<Section[]> => {
    const rows = await sql<Row[]>`select * from sections order by sort_order asc`;
    const all = rows.map((r) => ({
      key: r.key as SectionKey,
      label: String(r.label ?? ""),
      sortOrder: Number(r.sort_order),
      isVisible: toBool(r.is_visible),
      content: parseSectionContent(String(r.key), parseJson(r.content, {})),
      index: 0,
    })) as Section[];

    let n = 0;
    for (const s of all) if (s.isVisible) s.index = ++n;

    return all;
  },
  ["sections"],
  { tags: ["site", "sections"], revalidate: 3600 }
);

const fetchSections = cache(async (): Promise<Section[]> => {
  return cachedFetchSections();
});

export async function listSections(opts: { visibleOnly?: boolean } = {}): Promise<Section[]> {
  const all = await fetchSections();
  return opts.visibleOnly ? all.filter((s) => s.isVisible) : all;
}

export async function getSection<T>(key: SectionKey): Promise<Section<T> | null> {
  const all = await listSections();
  return (all.find((s) => s.key === key) as Section<T> | undefined) ?? null;
}

export const heroSection = () => getSection<HeroContent>("hero");
export const workSection = () => getSection<WorkContent>("work");
export const aboutSection = () => getSection<AboutContent>("about");
export const contactSection = () => getSection<ContactContent>("contact");

export async function updateSectionContent(key: SectionKey, content: unknown): Promise<void> {
  await sql`
    update sections set content = ${sql.json(content as never)}, updated_at = now()
    where key = ${key}`;
}

export async function updateSectionMeta(
  key: SectionKey,
  patch: { label?: string; isVisible?: boolean },
): Promise<void> {
  if (patch.label !== undefined) {
    await sql`update sections set label = ${patch.label} where key = ${key}`;
  }
  if (patch.isVisible !== undefined) {
    await sql`update sections set is_visible = ${patch.isVisible} where key = ${key}`;
  }
}

const CHAPTER_ORDER: SectionKey[] = ["hero", "work", "about", "contact"];

export async function reorderSections(keys: string[]): Promise<void> {
  await sql.begin(async (tx) => {
    for (const [i, key] of keys.entries()) {
      if (!CHAPTER_ORDER.includes(key as SectionKey)) continue;
      await tx`update sections set sort_order = ${i + 1} where key = ${key}`;
    }
  });
}

// --- Site settings ----------------------------------------------------------

const DEFAULT_UI_LABELS: UiLabels = uiLabelsSchema.parse({});

const cachedGetSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const [r = {} as Row] = await sql<Row[]>`select * from site_settings where id = 1`;
    const availability = availabilitySchema.parse(parseJson(r.availability, {}));
    const gallery = gallerySettingsSchema.parse(parseJson(r.gallery_settings, {}));
    const stored = parseJson<Partial<UiLabels> & { showFloatingWhatsApp?: boolean }>(r.ui_labels, {});
    const uiLabels = uiLabelsSchema.parse(stored);

    const [ogImage, favicon] = await Promise.all([
      getMedia(r.og_image_id as string),
      getMedia(r.favicon_id as string),
    ]);

    return {
      siteTitlePattern: String(r.site_title_pattern ?? "%s — Dani Setiadi"),
      metaDescription: String(r.meta_description ?? ""),
      ogImageId: (r.og_image_id as string) ?? null,
      ogImage,
      faviconId: (r.favicon_id as string) ?? null,
      favicon,
      cvPath: (r.cv_path as string) ?? null,
      cvFilename: (r.cv_filename as string) ?? null,
      contactEmail: String(r.contact_email ?? ""),
      whatsappE164: String(r.whatsapp_e164 ?? ""),
      whatsappMessage: String(r.whatsapp_message ?? ""),
      socialLinks: parseJson<SocialLink[]>(r.social_links, []),
      availability: availability as Availability,
      gallery: gallery as GallerySettings,
      uiLabels: { ...DEFAULT_UI_LABELS, ...uiLabels },
      showFloatingWhatsApp: stored.showFloatingWhatsApp === true,
    };
  },
  ["site-settings"],
  { tags: ["site", "settings"], revalidate: 3600 }
);

export const getSettings = cache(async (): Promise<SiteSettings> => {
  return cachedGetSettings();
});

export async function updateSettings(patch: Record<string, unknown>): Promise<void> {
  const column: Record<string, string> = {
    siteTitlePattern: "site_title_pattern",
    metaDescription: "meta_description",
    ogImageId: "og_image_id",
    faviconId: "favicon_id",
    cvPath: "cv_path",
    cvFilename: "cv_filename",
    contactEmail: "contact_email",
    whatsappE164: "whatsapp_e164",
    whatsappMessage: "whatsapp_message",
  };
  const jsonColumn: Record<string, string> = {
    socialLinks: "social_links",
    availability: "availability",
    gallery: "gallery_settings",
    uiLabels: "ui_labels",
  };

  const sets: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(column)) {
    if (patch[key] !== undefined) sets[col] = patch[key];
  }
  for (const [key, col] of Object.entries(jsonColumn)) {
    if (patch[key] !== undefined) sets[col] = sql.json(patch[key] as never);
  }
  if (Object.keys(sets).length === 0) return;
  sets.updated_at = new Date().toISOString();
  await sql`update site_settings set ${sql(sets)} where id = 1`;
}

// --- Tools ------------------------------------------------------------------

const cachedFetchTools = unstable_cache(
  async (): Promise<Tool[]> => {
    const rows = await sql<Row[]>`select * from tools order by sort_order asc`;
    const icons = await getMediaMany(rows.map((r) => r.icon_media_id as string).filter(Boolean));
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      iconMediaId: (r.icon_media_id as string) ?? null,
      icon: r.icon_media_id ? (icons.get(String(r.icon_media_id)) ?? null) : null,
      url: (r.url as string) ?? null,
      sortOrder: Number(r.sort_order),
      isVisible: toBool(r.is_visible),
    }));
  },
  ["tools"],
  { tags: ["site", "tools"], revalidate: 3600 }
);

const fetchTools = cache(async (): Promise<Tool[]> => {
  return cachedFetchTools();
});

export async function listTools(opts: { visibleOnly?: boolean } = {}): Promise<Tool[]> {
  const all = await fetchTools();
  return opts.visibleOnly ? all.filter((t) => t.isVisible) : all;
}

type ToolInput = { name: string; iconMediaId?: string | null; url?: string | null; isVisible?: boolean };

export async function createTool(input: ToolInput): Promise<string> {
  const [row] = await sql<Row[]>`
    insert into tools (name, icon_media_id, url, sort_order, is_visible)
    values (${input.name}, ${input.iconMediaId ?? null}, ${input.url || null},
            (select coalesce(max(sort_order), 0) + 1 from tools),
            ${input.isVisible !== false})
    returning id`;
  return String(row.id);
}

export async function updateTool(id: string, input: ToolInput): Promise<void> {
  await sql`
    update tools set name = ${input.name}, icon_media_id = ${input.iconMediaId ?? null},
      url = ${input.url || null}, is_visible = ${input.isVisible !== false}
    where id = ${id}`;
}

export async function deleteTool(id: string): Promise<void> {
  await sql`delete from tools where id = ${id}`;
}

export const reorderTools = (ids: string[]) => reorder("tools", ids);

// --- Experience -------------------------------------------------------------

const cachedFetchExperiences = unstable_cache(
  async (): Promise<Experience[]> => {
    const rows = await sql<Row[]>`select * from experiences order by sort_order asc`;
    return rows.map((r) => ({
      id: String(r.id),
      company: String(r.company),
      role: String(r.role ?? ""),
      workType: String(r.work_type ?? "Remote"),
      startYear: r.start_year === null ? null : Number(r.start_year),
      startMonth: r.start_month === null ? null : Number(r.start_month),
      endYear: r.end_year === null ? null : Number(r.end_year),
      endMonth: r.end_month === null ? null : Number(r.end_month),
      isCurrent: toBool(r.is_current),
      description: String(r.description ?? ""),
      sortOrder: Number(r.sort_order),
      isVisible: toBool(r.is_visible),
    }));
  },
  ["experiences"],
  { tags: ["site", "experiences"], revalidate: 3600 }
);

const fetchExperiences = cache(async (): Promise<Experience[]> => {
  return cachedFetchExperiences();
});

export async function listExperiences(
  opts: { visibleOnly?: boolean } = {},
): Promise<Experience[]> {
  const all = await fetchExperiences();
  return opts.visibleOnly ? all.filter((e) => e.isVisible) : all;
}

type ExperienceInput = Omit<
  Experience,
  "id" | "sortOrder" | "isVisible" | "startYear" | "startMonth" | "endYear" | "endMonth"
> & {
  startYear?: number | null;
  startMonth?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  isVisible?: boolean;
};

export async function createExperience(input: ExperienceInput): Promise<string> {
  const [row] = await sql<Row[]>`
    insert into experiences (company, role, work_type, start_year, start_month, end_year,
      end_month, is_current, description, sort_order, is_visible)
    values (${input.company}, ${input.role}, ${input.workType},
      ${input.startYear ?? null}, ${input.startMonth ?? null},
      ${input.isCurrent ? null : (input.endYear ?? null)},
      ${input.isCurrent ? null : (input.endMonth ?? null)},
      ${input.isCurrent}, ${input.description},
      (select coalesce(max(sort_order), 0) + 1 from experiences),
      ${input.isVisible !== false})
    returning id`;
  return String(row.id);
}

export async function updateExperience(id: string, input: ExperienceInput): Promise<void> {
  await sql`
    update experiences set company = ${input.company}, role = ${input.role},
      work_type = ${input.workType}, start_year = ${input.startYear ?? null},
      start_month = ${input.startMonth ?? null},
      end_year = ${input.isCurrent ? null : (input.endYear ?? null)},
      end_month = ${input.isCurrent ? null : (input.endMonth ?? null)},
      is_current = ${input.isCurrent}, description = ${input.description},
      is_visible = ${input.isVisible !== false}
    where id = ${id}`;
}

export async function deleteExperience(id: string): Promise<void> {
  await sql`delete from experiences where id = ${id}`;
}

export const reorderExperiences = (ids: string[]) => reorder("experiences", ids);

/** ABOUT-02 — auto-sort newest first, current roles at the top. */
export async function autoSortExperiences(): Promise<void> {
  const items = await listExperiences();
  const score = (e: Experience) =>
    (e.isCurrent ? 1e9 : 0) + (e.endYear ?? e.startYear ?? 0) * 100 + (e.endMonth ?? 0);
  const ordered = [...items].sort((a, b) => score(b) - score(a));
  await reorder("experiences", ordered.map((e) => e.id));
}

// --- Categories -------------------------------------------------------------

function rowToCategory(r: Row): Category {
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    sortOrder: Number(r.sort_order),
    isVisible: toBool(r.is_visible),
  };
}

const cachedFetchCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const rows = await sql<Row[]>`select * from categories order by sort_order asc`;
    return rows.map(rowToCategory);
  },
  ["categories"],
  { tags: ["site", "categories"], revalidate: 3600 }
);

const fetchCategories = cache(async (): Promise<Category[]> => {
  return cachedFetchCategories();
});

export async function listCategories(
  opts: { visibleOnly?: boolean } = {},
): Promise<Category[]> {
  const all = await fetchCategories();
  return opts.visibleOnly ? all.filter((c) => c.isVisible) : all;
}

const cachedListActiveCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const rows = await sql<Row[]>`
      select c.* from categories c
      where c.is_visible and exists (
        select 1 from project_categories pc
        join projects p on p.id = pc.project_id
        where pc.category_id = c.id and p.status = 'published' and p.deleted_at is null)
      order by c.sort_order asc`;
    return rows.map(rowToCategory);
  },
  ["active-categories"],
  { tags: ["site", "categories", "projects"], revalidate: 3600 }
);

/** Categories that have at least one published project (PRD §7.3.3 filters). */
export const listActiveCategories = cache(async (): Promise<Category[]> => {
  return cachedListActiveCategories();
});

export async function createCategory(name: string, isVisible = true): Promise<string> {
  const slug = await uniqueSlug("categories", slugify(name));
  const [row] = await sql<Row[]>`
    insert into categories (name, slug, sort_order, is_visible)
    values (${name}, ${slug}, (select coalesce(max(sort_order), 0) + 1 from categories), ${isVisible})
    returning id`;
  return String(row.id);
}

export async function updateCategory(id: string, name: string, isVisible: boolean): Promise<void> {
  await sql`update categories set name = ${name}, is_visible = ${isVisible} where id = ${id}`;
}

/** Deleting a category can first move its projects elsewhere (PRD §9.3). */
export async function deleteCategory(id: string, moveToId?: string | null): Promise<void> {
  await sql.begin(async (tx) => {
    if (moveToId) {
      await tx`
        insert into project_categories (project_id, category_id)
        select project_id, ${moveToId} from project_categories where category_id = ${id}
        on conflict do nothing`;
    }
    await tx`delete from categories where id = ${id}`;
  });
}

export const reorderCategories = (ids: string[]) => reorder("categories", ids);

// --- Shared helpers ---------------------------------------------------------

const REORDERABLE = new Set(["tools", "experiences", "categories", "projects", "project_media"]);

async function reorder(table: string, ids: string[]): Promise<void> {
  if (!REORDERABLE.has(table)) throw new Error(`Refusing to reorder unknown table ${table}`);
  if (ids.length === 0) return;
  await sql.begin(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx`update ${tx(table)} set sort_order = ${i + 1} where id = ${id}`;
    }
  });
}

const SLUGGABLE = new Set(["categories", "projects"]);

export async function uniqueSlug(table: string, base: string, ignoreId?: string): Promise<string> {
  if (!SLUGGABLE.has(table)) throw new Error(`Refusing to slug unknown table ${table}`);
  let candidate = base;
  let n = 1;
  for (;;) {
    const rows = ignoreId
      ? await sql<Row[]>`select id from ${sql(table)} where slug = ${candidate} and id <> ${ignoreId}`
      : await sql<Row[]>`select id from ${sql(table)} where slug = ${candidate}`;
    if (rows.length === 0) return candidate;
    candidate = `${base}-${++n}`;
  }
}

// --- Project links / gallery rows used by the project repo ------------------

export async function projectLinks(projectId: string): Promise<ProjectLink[]> {
  const rows = await sql<Row[]>`
    select * from project_links where project_id = ${projectId} order by sort_order asc`;
  return rows.map((r) => ({
    id: String(r.id),
    label: String(r.label),
    url: String(r.url),
    sortOrder: Number(r.sort_order),
  }));
}

export async function projectGallery(projectId: string): Promise<ProjectMediaItem[]> {
  const rows = await sql<Row[]>`
    select * from project_media where project_id = ${projectId} order by sort_order asc`;
  const media = await getMediaMany(rows.map((r) => String(r.media_id)));
  return rows.map((r) => ({
    id: String(r.id),
    mediaId: String(r.media_id),
    media: media.get(String(r.media_id)) ?? null,
    sortOrder: Number(r.sort_order),
    width: (r.width as ProjectMediaItem["width"]) ?? "full",
    caption: (r.caption as string) ?? null,
  }));
}

export type { Project };
