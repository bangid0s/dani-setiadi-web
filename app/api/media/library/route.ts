import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listMedia } from "@/lib/repo/media";

export const runtime = "nodejs";

/** Powers "Choose from library" inside the Media Field (PRD §8.6). */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const url = new URL(request.url);
  const source = url.searchParams.get("source") as "upload" | "url" | "youtube" | "all" | null;
  const { items, total } = listMedia({
    source: source ?? "all",
    search: url.searchParams.get("q") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 48),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return NextResponse.json({ items, total });
}
