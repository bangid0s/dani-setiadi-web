"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, setAdminPassword, createAdmin, deleteAdmin, countAdmins, findAdminByEmail } from "@/lib/auth";
import { slugify } from "@/lib/ids";
import {
  sectionSchemas, availabilitySchema, gallerySettingsSchema, uiLabelsSchema,
  siteSettingsSchema, socialLinkSchema, toolSchema, experienceSchema, categorySchema,
  projectSchema, mediaMetaSchema, passwordSchema,
} from "@/lib/validation";
import {
  updateSectionContent, updateSectionMeta, reorderSections, getSection, getSettings,
  updateSettings, createTool, updateTool, deleteTool, reorderTools, createExperience,
  updateExperience, deleteExperience, reorderExperiences, autoSortExperiences,
  createCategory, updateCategory, deleteCategory, reorderCategories,
} from "@/lib/repo/content";
import {
  createProject, updateProject, setProjectStatus, toggleFeatured, reorderProjects,
  reorderFeatured, softDeleteProject, hardDeleteProject, restoreProject, getProjectById,
  addProjectMedia, updateProjectMedia, removeProjectMedia, reorderProjectMedia,
  setProjectLinks, publishBlockers,
} from "@/lib/repo/projects";
import { updateMediaMeta, softDeleteMedia, getMedia } from "@/lib/repo/media";
import { deleteStoredFile } from "@/lib/media/process";
import type { SectionKey } from "@/lib/types";

export type ActionState = { error: string | null; success?: string | null };
const ok = (success: string): ActionState => ({ error: null, success });
const fail = (error: string): ActionState => ({ error, success: null });

/** Every admin write refreshes the public cache (PRD §10.3 / §11.2). */
function revalidateSite() {
  revalidatePath("/", "layout");
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const bool = (fd: FormData, key: string) => fd.getAll(key).includes("1");
const num = (fd: FormData, key: string): number | null => {
  const v = str(fd, key).trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const list = (fd: FormData, key: string) => fd.getAll(key).map(String).filter(Boolean);

function firstIssue(err: { issues: { message: string; path: (string | number)[] }[] }): string {
  const issue = err.issues[0];
  return issue ? `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}` : "Check the form and try again.";
}

// --- Sections ---------------------------------------------------------------

export async function saveSectionAction(
  key: SectionKey,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const schema = sectionSchemas[key];
  if (!schema) return fail("Unknown chapter.");

  const existing = getSection(key)?.content as Record<string, unknown> | undefined;
  const raw: Record<string, unknown> = { ...existing };

  for (const [field, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    raw[field] = value;
  }
  // Checkboxes: the hidden "0" companion means an absent box reads as false.
  for (const flag of [
    "showLocationIcon", "showFeatured", "showTools", "showAvailability",
    "showEmail", "showWhatsApp", "showSocials", "showCv", "showForm",
  ]) {
    if (formData.has(flag)) raw[flag] = bool(formData, flag);
  }
  if (formData.has("portraitPositionX") || formData.has("portraitPositionY")) {
    raw.portraitPosition = {
      x: num(formData, "portraitPositionX") ?? 53,
      y: num(formData, "portraitPositionY") ?? 100,
    };
  }
  for (const nullable of ["portraitId", "greetingSvgId"]) {
    if (formData.has(nullable)) raw[nullable] = str(formData, nullable) || null;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  updateSectionContent(key, parsed.data);
  if (formData.has("__label")) {
    updateSectionMeta(key, { label: str(formData, "__label").slice(0, 32) });
  }
  revalidateSite();
  return ok("Changes published.");
}

export async function saveSectionsOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  reorderSections(list(formData, "key"));
  for (const key of list(formData, "key")) {
    updateSectionMeta(key as SectionKey, {
      label: String(formData.get(`label-${key}`) ?? "").slice(0, 32) || key,
      isVisible: formData.getAll(`visible-${key}`).includes("1"),
    });
  }
  revalidateSite();
  revalidatePath("/admin/sections");
}

// --- Settings ---------------------------------------------------------------

export async function saveSiteSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = siteSettingsSchema.safeParse({
    siteTitlePattern: str(formData, "siteTitlePattern"),
    metaDescription: str(formData, "metaDescription"),
    contactEmail: str(formData, "contactEmail"),
    whatsappE164: str(formData, "whatsappE164"),
    whatsappMessage: str(formData, "whatsappMessage"),
    showFloatingWhatsApp: bool(formData, "showFloatingWhatsApp"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const current = getSettings();
  updateSettings({
    ...parsed.data,
    ogImageId: formData.has("ogImageId") ? str(formData, "ogImageId") || null : undefined,
    faviconId: formData.has("faviconId") ? str(formData, "faviconId") || null : undefined,
    uiLabels: { ...current.uiLabels, showFloatingWhatsApp: parsed.data.showFloatingWhatsApp },
  });
  revalidateSite();
  return ok("Settings saved.");
}

export async function saveAvailabilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = availabilitySchema.safeParse({
    status: str(formData, "status"),
    label: str(formData, "label"),
    caption: str(formData, "caption"),
    linkTarget: str(formData, "linkTarget"),
    hideWhenClosed: bool(formData, "hideWhenClosed"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  updateSettings({ availability: parsed.data });
  revalidateSite();
  return ok("Availability updated.");
}

export async function saveDisplaySettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = gallerySettingsSchema.safeParse({
    layout: str(formData, "layout"),
    columns: {
      desktop: num(formData, "colDesktop") ?? 3,
      tablet: num(formData, "colTablet") ?? 2,
      mobile: num(formData, "colMobile") ?? 1,
    },
    gap: str(formData, "gap"),
    pageSize: { home: num(formData, "pageHome") ?? 9, work: num(formData, "pageWork") ?? 12 },
    showFilters: bool(formData, "showFilters"),
    captionStyle: str(formData, "captionStyle"),
    includeFeatured: bool(formData, "includeFeatured"),
    defaultOpenAs: str(formData, "defaultOpenAs"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  updateSettings({ gallery: parsed.data });
  revalidateSite();
  return ok("Display settings saved.");
}

export async function saveUiLabelsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") raw[k] = v;
  raw.showFooterCredit = bool(formData, "showFooterCredit");
  const parsed = uiLabelsSchema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const current = getSettings();
  updateSettings({
    uiLabels: { ...parsed.data, showFloatingWhatsApp: current.showFloatingWhatsApp },
  });
  revalidateSite();
  return ok("Labels saved.");
}

export async function saveSocialLinksAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const platforms = list(formData, "platform");
  const urls = formData.getAll("url").map(String);
  const labels = formData.getAll("label").map(String);
  const links = [];
  for (let i = 0; i < platforms.length; i++) {
    if (!platforms[i].trim() || !urls[i]?.trim()) continue;
    const parsed = socialLinkSchema.safeParse({
      platform: platforms[i],
      label: labels[i] ?? platforms[i],
      url: urls[i],
      showInFooter: formData.getAll(`footer-${i}`).includes("1"),
      showInContact: formData.getAll(`contact-${i}`).includes("1"),
    });
    if (!parsed.success) return fail(`${platforms[i]}: ${firstIssue(parsed.error)}`);
    links.push(parsed.data);
  }
  updateSettings({ socialLinks: links });
  revalidateSite();
  return ok("Social links saved.");
}

export async function setCvAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const path = str(formData, "cvPath");
  const filename = str(formData, "cvFilename");
  const current = getSettings();
  if (!path) {
    if (current.cvPath) await deleteStoredFile(current.cvPath);
    updateSettings({ cvPath: null, cvFilename: null });
    revalidateSite();
    return ok("CV removed.");
  }
  if (current.cvPath && current.cvPath !== path) await deleteStoredFile(current.cvPath);
  updateSettings({ cvPath: path, cvFilename: filename });
  revalidateSite();
  return ok("CV updated.");
}

// --- Tools ------------------------------------------------------------------

export async function saveToolAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = toolSchema.safeParse({
    name: str(formData, "name"),
    iconMediaId: str(formData, "iconMediaId") || null,
    url: str(formData, "url") || null,
    isVisible: bool(formData, "isVisible"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const id = str(formData, "id");
  if (id) updateTool(id, parsed.data);
  else createTool(parsed.data);
  revalidateSite();
  revalidatePath("/admin/tools");
  return ok(id ? "Tool updated." : "Tool added.");
}

export async function deleteToolAction(formData: FormData): Promise<void> {
  await requireAdmin();
  deleteTool(str(formData, "id"));
  revalidateSite();
  revalidatePath("/admin/tools");
}

export async function reorderToolsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  reorderTools(list(formData, "id"));
  revalidateSite();
  revalidatePath("/admin/tools");
}

// --- Experience -------------------------------------------------------------

export async function saveExperienceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = experienceSchema.safeParse({
    company: str(formData, "company"),
    role: str(formData, "role"),
    workType: str(formData, "workType") || "Remote",
    startYear: num(formData, "startYear"),
    startMonth: num(formData, "startMonth"),
    endYear: num(formData, "endYear"),
    endMonth: num(formData, "endMonth"),
    isCurrent: bool(formData, "isCurrent"),
    description: str(formData, "description"),
    isVisible: bool(formData, "isVisible"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const id = str(formData, "id");
  if (id) updateExperience(id, parsed.data);
  else createExperience(parsed.data);
  revalidateSite();
  revalidatePath("/admin/experience");
  return ok(id ? "Entry updated." : "Entry added.");
}

export async function deleteExperienceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  deleteExperience(str(formData, "id"));
  revalidateSite();
  revalidatePath("/admin/experience");
}

export async function reorderExperiencesAction(formData: FormData): Promise<void> {
  await requireAdmin();
  if (str(formData, "mode") === "auto") autoSortExperiences();
  else reorderExperiences(list(formData, "id"));
  revalidateSite();
  revalidatePath("/admin/experience");
}

// --- Categories -------------------------------------------------------------

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = categorySchema.safeParse({
    name: str(formData, "name"),
    isVisible: bool(formData, "isVisible"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const id = str(formData, "id");
  if (id) updateCategory(id, parsed.data.name, parsed.data.isVisible);
  else createCategory(parsed.data.name, parsed.data.isVisible);
  revalidateSite();
  revalidatePath("/admin/categories");
  return ok(id ? "Category updated." : "Category added.");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  deleteCategory(str(formData, "id"), str(formData, "moveTo") || null);
  revalidateSite();
  revalidatePath("/admin/categories");
}

export async function reorderCategoriesAction(formData: FormData): Promise<void> {
  await requireAdmin();
  reorderCategories(list(formData, "id"));
  revalidateSite();
  revalidatePath("/admin/categories");
}

// --- Projects ---------------------------------------------------------------

export async function saveProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = str(formData, "id");
  const title = str(formData, "title");
  const intent = str(formData, "intent"); // draft | publish | update

  const parsed = projectSchema.safeParse({
    title,
    slug: str(formData, "slug") || slugify(title),
    client: str(formData, "client"),
    year: num(formData, "year"),
    role: str(formData, "role"),
    summary: str(formData, "summary"),
    body: str(formData, "body"),
    coverMediaId: str(formData, "coverMediaId") || null,
    cardRatio: str(formData, "cardRatio") || "auto",
    openAs: str(formData, "openAs") || "auto",
    externalUrl: str(formData, "externalUrl"),
    isFeatured: bool(formData, "isFeatured"),
    status: intent === "publish" ? "published" : str(formData, "status") || "draft",
    seoTitle: str(formData, "seoTitle"),
    seoDescription: str(formData, "seoDescription"),
    categoryIds: list(formData, "categoryIds"),
    toolIds: list(formData, "toolIds"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const projectId = id || createProject({ ...parsed.data, status: "draft" });

  // Links are saved before the publish check so nothing is lost on a block.
  const linkLabels = formData.getAll("linkLabel").map(String);
  const linkUrls = formData.getAll("linkUrl").map(String);
  setProjectLinks(
    projectId,
    linkLabels.map((label, i) => ({ label, url: linkUrls[i] ?? "" })),
  );

  if (intent === "publish") {
    // §9.4 publish checklist — block with a specific message for each failure.
    updateProject(projectId, { ...parsed.data, status: "draft" });
    const project = getProjectById(projectId);
    const blockers = project ? publishBlockers({ ...project, openAs: parsed.data.openAs, externalUrl: parsed.data.externalUrl ?? null }) : [];
    if (blockers.length > 0) {
      revalidatePath(`/admin/projects/${projectId}`);
      return { error: blockers.map((b) => b.message).join(" "), success: null };
    }
    updateProject(projectId, { ...parsed.data, status: "published" });
  } else {
    updateProject(projectId, parsed.data);
  }

  revalidateSite();
  revalidatePath(`/admin/projects/${projectId}`);
  if (!id) redirect(`/admin/projects/${projectId}`);
  return ok(intent === "publish" ? "Published." : "Saved.");
}

export async function createProjectAction(): Promise<void> {
  await requireAdmin();
  const id = createProject({ title: "Untitled project", slug: slugify("untitled project") });
  revalidatePath("/admin/projects");
  redirect(`/admin/projects/${id}`);
}

export async function bulkProjectAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ids = list(formData, "selected");
  const op = str(formData, "op");
  for (const id of ids) {
    if (op === "publish") setProjectStatus(id, "published");
    else if (op === "unpublish") setProjectStatus(id, "draft");
    else if (op === "archive") setProjectStatus(id, "archived");
    else if (op === "delete") softDeleteProject(id);
    else if (op === "restore") restoreProject(id);
    else if (op === "destroy") hardDeleteProject(id);
  }
  revalidateSite();
  revalidatePath("/admin/projects");
}

export async function toggleFeaturedAction(formData: FormData): Promise<void> {
  await requireAdmin();
  toggleFeatured(str(formData, "id"), str(formData, "featured") === "1");
  revalidateSite();
  revalidatePath("/admin/projects");
}

export async function reorderProjectsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  if (str(formData, "scope") === "featured") reorderFeatured(list(formData, "id"));
  else reorderProjects(list(formData, "id"));
  revalidateSite();
  revalidatePath("/admin/projects");
}

// --- Project gallery --------------------------------------------------------

export async function addProjectMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = str(formData, "projectId");
  for (const mediaId of list(formData, "mediaId")) {
    addProjectMedia(projectId, mediaId, str(formData, "width") === "half" ? "half" : "full");
  }
  revalidateSite();
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function updateProjectMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();
  updateProjectMedia(str(formData, "id"), {
    width: str(formData, "width") === "half" ? "half" : "full",
    caption: str(formData, "caption"),
  });
  revalidateSite();
  revalidatePath(`/admin/projects/${str(formData, "projectId")}`);
}

export async function removeProjectMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();
  removeProjectMedia(str(formData, "id"));
  revalidateSite();
  revalidatePath(`/admin/projects/${str(formData, "projectId")}`);
}

export async function reorderProjectMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();
  reorderProjectMedia(list(formData, "id"));
  revalidateSite();
  revalidatePath(`/admin/projects/${str(formData, "projectId")}`);
}

// --- Media library ----------------------------------------------------------

export async function saveMediaMetaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = mediaMetaSchema.safeParse({
    altText: str(formData, "altText"),
    isDecorative: bool(formData, "isDecorative"),
    focalX: num(formData, "focalX") ?? 0.5,
    focalY: num(formData, "focalY") ?? 0.5,
    title: str(formData, "title"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  updateMediaMeta(str(formData, "id"), parsed.data);
  revalidateSite();
  revalidatePath("/admin/media");
  return ok("Saved.");
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "id");
  const media = getMedia(id);
  softDeleteMedia(id);
  if (media?.storagePath) await deleteStoredFile(media.storagePath);
  revalidateSite();
  revalidatePath("/admin/media");
}

// --- Account ----------------------------------------------------------------

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireAdmin();
  const next = str(formData, "password");
  const confirm = str(formData, "confirm");
  if (next !== confirm) return fail("The two passwords don’t match.");
  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  await setAdminPassword(me.userId, parsed.data);
  return ok("Password changed. Other devices have been signed out.");
}

export async function inviteAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const email = str(formData, "email").trim().toLowerCase();
  const password = str(formData, "password");
  if (!email.includes("@")) return fail("Enter a valid email address.");
  if (findAdminByEmail(email)) return fail("That email already has access.");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  await createAdmin(email, parsed.data, str(formData, "name"), "maintainer");
  revalidatePath("/admin/settings");
  return ok(`${email} can now sign in. Share the password with them privately and ask them to change it.`);
}

export async function removeAdminAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const userId = str(formData, "userId");
  // Never remove the last admin, and never let someone lock themselves out.
  if (userId === me.userId || countAdmins() <= 1) return;
  deleteAdmin(userId);
  revalidatePath("/admin/settings");
}
