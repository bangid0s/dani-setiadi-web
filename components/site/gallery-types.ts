import type { CardRatio, Media, OpenAs } from "@/lib/types";

/** The flattened shape the gallery and lightbox work with on the client. */
export type GalleryItem = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  categoryName: string;
  categorySlugs: string[];
  cardRatio: CardRatio;
  /** Numeric width / height used for layout, already honouring the preset. */
  ratio: number;
  openAs: OpenAs;
  externalUrl: string | null;
  /** True when the project has a story or extra gallery items worth a page. */
  hasPage: boolean;
  media: Media | null;
  poster: Media | null;
  summary: string | null;
};

/** PRD §7.3.4 — resolve the "Open as" setting into one concrete behaviour. */
export function resolveOpenAs(item: GalleryItem, fallback: OpenAs): "lightbox" | "page" | "external" {
  const mode = item.openAs === "auto" ? fallback : item.openAs;
  if (mode === "external") return item.externalUrl ? "external" : "page";
  if (mode === "lightbox") return "lightbox";
  if (mode === "page") return "page";
  // Auto — lightbox when it is a single media item with no story, else the page.
  return item.hasPage ? "page" : "lightbox";
}
