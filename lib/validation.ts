import { z } from "zod";

/**
 * PRD §9.5 Content guardrails.
 * `rec` drives the soft warning + character counter in admin; `max` is the hard
 * stop enforced here, so the same numbers govern client and server.
 */
export const LIMITS = {
  displayName: { rec: 14, max: 28 },
  greetingText: { rec: 10, max: 20 },
  headingLead: { rec: 14, max: 24 },
  headingKeyword: { rec: 10, max: 16 },
  roleLine: { rec: 36, max: 60 },
  locationLine: { rec: 48, max: 80 },
  bio: { rec: 450, recMin: 200, max: 700 },
  pillLabel: { rec: 16, max: 22 },
  pillCaption: { rec: 32, max: 48 },
  experienceDescription: { rec: 280, max: 400 },
  projectTitle: { rec: 32, max: 60 },
  projectSummary: { rec: 160, max: 240 },
  altText: { rec: 125, max: 250 },
} as const;

const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number, field: string) =>
  z.string().trim().min(1, `${field} is required`).max(max);

// --- Chapter content (PRD §10.2) -------------------------------------------

export const heroContentSchema = z.object({
  greetingMode: z.enum(["svg", "text"]).default("text"),
  greetingText: trimmed(LIMITS.greetingText.max).default("Hi, I’m"),
  greetingSvgId: z.string().nullable().optional(),
  displayName: required(LIMITS.displayName.max, "Display name"),
  nameLayout: z.enum(["auto", "one-line", "two-lines"]).default("auto"),
  nameScale: z.coerce.number().min(0.9).max(1.1).default(1),
  roleLine: trimmed(LIMITS.roleLine.max).default(""),
  locationLine: trimmed(LIMITS.locationLine.max).default(""),
  showLocationIcon: z.coerce.boolean().default(true),
  portraitId: z.string().nullable().optional(),
  portraitStyle: z.enum(["cutout", "matched-photo"]).default("cutout"),
  portraitPosition: z
    .object({ x: z.coerce.number().min(0).max(100), y: z.coerce.number().min(0).max(100) })
    .default({ x: 53, y: 100 }),
  portraitScale: z.coerce.number().min(0.5).max(1.5).default(1),
});

const twoTone = {
  lead: trimmed(LIMITS.headingLead.max),
  keyword: trimmed(LIMITS.headingKeyword.max),
};

export const workContentSchema = z.object({
  ...twoTone,
  intro: trimmed(240).optional().default(""),
  showFeatured: z.coerce.boolean().default(true),
  seeAllLabel: trimmed(32).default("See all work"),
});

export const aboutContentSchema = z.object({
  ...twoTone,
  bio: trimmed(LIMITS.bio.max).default(""),
  toolsLabel: trimmed(24).default("Tools"),
  showTools: z.coerce.boolean().default(true),
  experienceHeading: trimmed(32).default("Experience"),
  showAvailability: z.coerce.boolean().default(true),
  cvLabel: trimmed(32).default("Download CV"),
});

export const contactContentSchema = z.object({
  ...twoTone,
  text: trimmed(400).optional().default(""),
  showEmail: z.coerce.boolean().default(true),
  showWhatsApp: z.coerce.boolean().default(true),
  showSocials: z.coerce.boolean().default(true),
  showCv: z.coerce.boolean().default(true),
  primaryChannel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  showForm: z.coerce.boolean().default(false),
});

export const sectionSchemas = {
  hero: heroContentSchema,
  work: workContentSchema,
  about: aboutContentSchema,
  contact: contactContentSchema,
} as const;

export type SectionSchemaKey = keyof typeof sectionSchemas;

/** Parse stored chapter JSON, filling defaults for anything missing. */
export function parseSectionContent(key: string, raw: unknown) {
  const schema = sectionSchemas[key as SectionSchemaKey];
  if (!schema) return raw as Record<string, unknown>;
  const result = schema.safeParse(raw ?? {});
  return result.success ? result.data : schema.parse({ displayName: "Dani Setiadi" });
}

// --- Settings ---------------------------------------------------------------

export const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(32),
  label: z.string().trim().max(48).default(""),
  url: z.string().trim().url("Enter a full URL including https://"),
  showInFooter: z.coerce.boolean().default(true),
  showInContact: z.coerce.boolean().default(true),
});

export const availabilitySchema = z.object({
  status: z.enum(["open", "limited", "closed"]).default("open"),
  label: trimmed(LIMITS.pillLabel.max).default("OPEN FOR WORK"),
  caption: trimmed(LIMITS.pillCaption.max).default(""),
  linkTarget: z.string().trim().max(300).default("contact"),
  hideWhenClosed: z.coerce.boolean().default(false),
});

export const gallerySettingsSchema = z.object({
  layout: z.enum(["masonry", "grid"]).default("masonry"),
  columns: z
    .object({
      desktop: z.coerce.number().int().min(2).max(4).default(3),
      tablet: z.coerce.number().int().min(1).max(3).default(2),
      mobile: z.coerce.number().int().min(1).max(2).default(1),
    })
    .default({ desktop: 3, tablet: 2, mobile: 1 }),
  gap: z.enum(["S", "M", "L"]).default("M"),
  pageSize: z
    .object({
      home: z.coerce.number().int().min(3).max(48).default(9),
      work: z.coerce.number().int().min(6).max(48).default(12),
    })
    .default({ home: 9, work: 12 }),
  showFilters: z.coerce.boolean().default(true),
  captionStyle: z.enum(["below", "overlay"]).default("below"),
  includeFeatured: z.coerce.boolean().default(true),
  defaultOpenAs: z.enum(["auto", "lightbox", "page", "external"]).default("auto"),
});

export const uiLabelsSchema = z.object({
  loadMore: trimmed(32).default("Load more work"),
  viewProject: trimmed(32).default("View project"),
  downloadCv: trimmed(32).default("Download CV"),
  allFilter: trimmed(24).default("All"),
  backToTop: trimmed(24).default("Back to top"),
  menu: trimmed(16).default("Menu"),
  skipToContent: trimmed(32).default("Skip to content"),
  notFoundLead: trimmed(24).default("Oops,"),
  notFoundKeyword: trimmed(16).default("404"),
  notFoundText: trimmed(160).default("This page doesn’t exist — the work does."),
  notFoundCta: trimmed(32).default("Back to home"),
  footerCredit: trimmed(80).default(""),
  showFooterCredit: z.coerce.boolean().default(false),
  imageUnavailable: trimmed(48).default("Image unavailable"),
  emptyWork: trimmed(120).default("New work is on its way."),
});

export const siteSettingsSchema = z.object({
  siteTitlePattern: z.string().trim().min(1).max(80).default("%s — Dani Setiadi"),
  metaDescription: trimmed(300).default(""),
  contactEmail: z.union([z.literal(""), z.string().trim().email()]).default(""),
  whatsappE164: z
    .union([z.literal(""), z.string().trim().regex(/^\+[1-9]\d{6,15}$/, "Use E.164 format, e.g. +6281234567890")])
    .default(""),
  whatsappMessage: trimmed(300).default(""),
  showFloatingWhatsApp: z.coerce.boolean().default(false),
});

// --- Content entities -------------------------------------------------------

export const toolSchema = z.object({
  name: required(48, "Tool name"),
  iconMediaId: z.string().nullable().optional(),
  url: z.union([z.literal(""), z.string().trim().url()]).nullable().optional(),
  isVisible: z.coerce.boolean().default(true),
});

export const experienceSchema = z
  .object({
    company: required(80, "Company"),
    role: trimmed(80).default(""),
    workType: z.enum(["Remote", "On-site", "Hybrid", "Freelance", "Contract"]).default("Remote"),
    startYear: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
    startMonth: z.coerce.number().int().min(1).max(12).nullable().optional(),
    endYear: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
    endMonth: z.coerce.number().int().min(1).max(12).nullable().optional(),
    isCurrent: z.coerce.boolean().default(false),
    description: trimmed(LIMITS.experienceDescription.max).default(""),
    isVisible: z.coerce.boolean().default(true),
  })
  .refine((v) => v.isCurrent || !v.startYear || !v.endYear || v.endYear >= v.startYear, {
    message: "The end year cannot be before the start year",
    path: ["endYear"],
  });

export const categorySchema = z.object({
  name: required(48, "Category name"),
  isVisible: z.coerce.boolean().default(true),
});

export const projectSchema = z.object({
  title: required(LIMITS.projectTitle.max, "Title"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  client: trimmed(80).nullable().optional(),
  year: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
  role: trimmed(80).nullable().optional(),
  summary: trimmed(LIMITS.projectSummary.max).nullable().optional(),
  body: z.string().max(20000).nullable().optional(),
  coverMediaId: z.string().nullable().optional(),
  cardRatio: z.enum(["auto", "1:1", "4:5", "3:4", "2:3", "16:9", "9:16"]).default("auto"),
  openAs: z.enum(["auto", "lightbox", "page", "external"]).default("auto"),
  externalUrl: z.union([z.literal(""), z.string().trim().url()]).nullable().optional(),
  isFeatured: z.coerce.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  seoTitle: trimmed(80).nullable().optional(),
  seoDescription: trimmed(300).nullable().optional(),
  categoryIds: z.array(z.string()).default([]),
  toolIds: z.array(z.string()).default([]),
});

export const mediaMetaSchema = z.object({
  altText: trimmed(LIMITS.altText.max).default(""),
  isDecorative: z.coerce.boolean().default(false),
  focalX: z.coerce.number().min(0).max(1).default(0.5),
  focalY: z.coerce.number().min(0).max(1).default(0.5),
  title: trimmed(200).nullable().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That password is too long");

export const contactMessageSchema = z.object({
  name: required(80, "Name"),
  email: z.string().trim().email("Enter a valid email address"),
  whatsapp: trimmed(32).optional().default(""),
  projectType: trimmed(60).optional().default(""),
  budget: trimmed(60).optional().default(""),
  message: z.string().trim().min(10, "Tell me a little more").max(4000),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree before sending" }) }),
});

/**
 * PRD §9.4 publish checklist — each failure is a specific, fixable message.
 * Returned as a list so admin can show them all at once.
 */
export type PublishBlocker = { field: string; message: string };
