// ============================================================================
// Domain types. Shapes follow PRD §10.1 (tables) and §10.2 (chapter content).
// ============================================================================

export type MediaSource = "upload" | "url" | "youtube";
export type CardRatio = "auto" | "1:1" | "4:5" | "3:4" | "2:3" | "16:9" | "9:16";
export type OpenAs = "auto" | "lightbox" | "page" | "external";
export type ProjectStatus = "draft" | "published" | "archived";
export type SectionKey = "hero" | "work" | "about" | "contact";
export type AvailabilityStatus = "open" | "limited" | "closed";
export type MediaWidth = "full" | "half";

export type Media = {
  id: string;
  source: MediaSource;
  storagePath: string | null;
  originalUrl: string | null;
  isHotlinked: boolean;
  youtubeId: string | null;
  youtubeIsShort: boolean;
  youtubeStart: number | null;
  title: string | null;
  mimeType: string | null;
  bytes: number | null;
  width: number;
  height: number;
  lqip: string | null;
  dominantColor: string | null;
  altText: string;
  isDecorative: boolean;
  focalX: number;
  focalY: number;
  posterMediaId: string | null;
  status: "ok" | "broken";
  createdAt: string;
};

export type Tool = {
  id: string;
  name: string;
  iconMediaId: string | null;
  icon: Media | null;
  url: string | null;
  sortOrder: number;
  isVisible: boolean;
};

export type Experience = {
  id: string;
  company: string;
  role: string;
  workType: string;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
  description: string;
  sortOrder: number;
  isVisible: boolean;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
};

export type ProjectLink = { id: string; label: string; url: string; sortOrder: number };

export type ProjectMediaItem = {
  id: string;
  mediaId: string;
  media: Media | null;
  sortOrder: number;
  width: MediaWidth;
  caption: string | null;
};

export type Project = {
  id: string;
  title: string;
  slug: string;
  client: string | null;
  year: number | null;
  role: string | null;
  summary: string | null;
  body: string | null;
  coverMediaId: string | null;
  cover: Media | null;
  cardRatio: CardRatio;
  openAs: OpenAs;
  externalUrl: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
  status: ProjectStatus;
  sortOrder: number;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  categories: Category[];
  tools: Tool[];
  gallery: ProjectMediaItem[];
  links: ProjectLink[];
  createdAt: string;
  updatedAt: string;
};

// --- Chapter content (PRD §10.2) -------------------------------------------

export type TwoTone = { lead: string; keyword: string };

export type HeroContent = {
  greetingMode: "svg" | "text";
  greetingText: string;
  greetingSvgId?: string | null;
  displayName: string;
  nameLayout: "auto" | "one-line" | "two-lines";
  nameScale: number; // 0.9–1.1
  roleLine: string;
  locationLine: string;
  showLocationIcon: boolean;
  portraitId?: string | null;
  portraitStyle: "cutout" | "matched-photo";
  portraitPosition: { x: number; y: number };
  portraitScale: number;
};

export type WorkContent = TwoTone & {
  intro?: string;
  showFeatured: boolean;
  seeAllLabel: string;
};

export type AboutContent = TwoTone & {
  bio: string; // markdown subset: bold / italic / link
  toolsLabel: string;
  showTools: boolean;
  experienceHeading: string;
  showAvailability: boolean;
  cvLabel: string;
};

export type ContactContent = TwoTone & {
  text?: string;
  showEmail: boolean;
  showWhatsApp: boolean;
  showSocials: boolean;
  showCv: boolean;
  primaryChannel: "whatsapp" | "email";
  showForm: boolean;
};

export type SectionContent = HeroContent | WorkContent | AboutContent | ContactContent;

export type Section<T = SectionContent> = {
  key: SectionKey;
  label: string;
  sortOrder: number;
  isVisible: boolean;
  content: T;
  /** 1-based position among *visible* chapters — drives "01/", "02/" (GLB-02). */
  index: number;
};

// --- Settings ---------------------------------------------------------------

export type SocialLink = {
  platform: string;
  label: string;
  url: string;
  showInFooter: boolean;
  showInContact: boolean;
};

export type Availability = {
  status: AvailabilityStatus;
  label: string;
  caption: string;
  linkTarget: string; // "contact" | "whatsapp" | "email" | absolute URL
  hideWhenClosed: boolean;
};

export type GallerySettings = {
  layout: "masonry" | "grid";
  columns: { desktop: number; tablet: number; mobile: number };
  gap: "S" | "M" | "L";
  pageSize: { home: number; work: number };
  showFilters: boolean;
  captionStyle: "below" | "overlay";
  includeFeatured: boolean;
  defaultOpenAs: OpenAs;
};

export type UiLabels = {
  loadMore: string;
  viewProject: string;
  downloadCv: string;
  allFilter: string;
  backToTop: string;
  menu: string;
  skipToContent: string;
  notFoundLead: string;
  notFoundKeyword: string;
  notFoundText: string;
  notFoundCta: string;
  footerCredit: string;
  showFooterCredit: boolean;
  imageUnavailable: string;
  emptyWork: string;
};

export type SiteSettings = {
  siteTitlePattern: string;
  metaDescription: string;
  ogImageId: string | null;
  ogImage: Media | null;
  faviconId: string | null;
  favicon: Media | null;
  cvPath: string | null;
  cvFilename: string | null;
  contactEmail: string;
  whatsappE164: string;
  whatsappMessage: string;
  socialLinks: SocialLink[];
  availability: Availability;
  gallery: GallerySettings;
  uiLabels: UiLabels;
  showFloatingWhatsApp: boolean;
};

export type AdminUser = {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "maintainer";
  createdAt: string;
};
