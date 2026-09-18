import "server-only";
import { getMedia, getMediaMany } from "@/lib/repo/media";
import { listProjects } from "@/lib/repo/projects";
import { cardRatio } from "@/lib/masonry";
import type { GalleryItem } from "@/components/site/gallery-types";
import type { Project } from "@/lib/types";

/** Flattens a single project into the shape the gallery and lightbox need. */
export async function toGalleryItem(p: Project): Promise<GalleryItem> {
  const media = p.cover;
  const ratio = media
    ? cardRatio(p.cardRatio, media.width, media.height)
    : cardRatio(p.cardRatio, 4, 5);

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    year: p.year,
    categoryName: p.categories[0]?.name ?? "",
    categorySlugs: p.categories.map((c) => c.slug),
    cardRatio: p.cardRatio,
    ratio,
    openAs: p.openAs,
    externalUrl: p.externalUrl,
    // A project earns its own page once it has a story, extra media or links.
    hasPage: Boolean(p.body?.trim()) || p.gallery.length > 0 || p.links.length > 0,
    media,
    poster: media?.posterMediaId ? await getMedia(media.posterMediaId) : null,
    summary: p.summary,
  };
}

/** Flattens multiple projects, batch-fetching all poster media in a single query. */
export async function toGalleryItems(projects: Project[]): Promise<GalleryItem[]> {
  const posterIds = projects
    .map((p) => p.cover?.posterMediaId)
    .filter((id): id is string => Boolean(id));
  const posters = posterIds.length > 0 ? await getMediaMany(posterIds) : new Map();

  return projects.map((p) => {
    const media = p.cover;
    const ratio = media
      ? cardRatio(p.cardRatio, media.width, media.height)
      : cardRatio(p.cardRatio, 4, 5);

    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      year: p.year,
      categoryName: p.categories[0]?.name ?? "",
      categorySlugs: p.categories.map((c) => c.slug),
      cardRatio: p.cardRatio,
      ratio,
      openAs: p.openAs,
      externalUrl: p.externalUrl,
      hasPage: Boolean(p.body?.trim()) || p.gallery.length > 0 || p.links.length > 0,
      media,
      poster: media?.posterMediaId ? (posters.get(media.posterMediaId) ?? null) : null,
      summary: p.summary,
    };
  });
}

/**
 * The published gallery, honouring the "include featured in the gallery too"
 * setting (PRD §7.3.2).
 */
export async function galleryProjects(includeFeatured: boolean): Promise<Project[]> {
  const { items } = await listProjects({
    status: "published",
    excludeFeatured: !includeFeatured,
  });
  return items;
}

export async function featuredProjects(): Promise<Project[]> {
  const { items } = await listProjects({ status: "published", featuredOnly: true, limit: 3 });
  return items;
}

/** Resolves an availability pill's link target into an href. */
export function availabilityHref(
  target: string,
  ctx: { whatsapp: string | null; email: string | null },
): string {
  if (target === "contact") return "#contact";
  if (target === "whatsapp") return ctx.whatsapp ?? "#contact";
  if (target === "email") return ctx.email ?? "#contact";
  return target || "#contact";
}
