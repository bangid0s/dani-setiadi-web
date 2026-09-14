import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mediaMetaSchema } from "@/lib/validation";
import { updateMediaMeta } from "@/lib/repo/media";

export const runtime = "nodejs";

/** Inline metadata saves from the Media Field (alt text, decorative, focal point). */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const parsed = mediaMetaSchema.safeParse({
    altText: String(form.get("altText") ?? ""),
    isDecorative: String(form.get("isDecorative") ?? "") === "1",
    focalX: Number(form.get("focalX") ?? 0.5),
    focalY: Number(form.get("focalY") ?? 0.5),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  await updateMediaMeta(id, parsed.data);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
