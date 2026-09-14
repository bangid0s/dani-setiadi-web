import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/ids";
import { createProject, addProjectMedia } from "@/lib/repo/projects";

export const runtime = "nodejs";

type Item = { mediaId: string; title: string };

/** PRD §9.3 Bulk upload — creates drafts from already-uploaded media. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { mode?: "per-file" | "single"; categoryId?: string | null; items?: Item[] }
    | null;
  const items = body?.items ?? [];
  if (items.length === 0) return NextResponse.json({ error: "Nothing to create." }, { status: 400 });

  const categoryIds = body?.categoryId ? [body.categoryId] : [];

  if (body?.mode === "single") {
    const title = items[0]?.title || "Untitled project";
    const projectId = createProject({
      title,
      slug: slugify(title),
      coverMediaId: items[0]?.mediaId ?? null,
      status: "draft",
      categoryIds,
    });
    for (const item of items.slice(1)) addProjectMedia(projectId, item.mediaId);
    revalidatePath("/admin/projects");
    return NextResponse.json({ projectId, created: 1 });
  }

  for (const item of items) {
    createProject({
      title: item.title,
      slug: slugify(item.title),
      coverMediaId: item.mediaId,
      status: "draft",
      categoryIds,
    });
  }
  revalidatePath("/admin/projects");
  return NextResponse.json({ created: items.length });
}
