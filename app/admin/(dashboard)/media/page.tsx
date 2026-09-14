import { PageHeader } from "@/components/admin/PageHeader";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { listMedia, mediaUsage } from "@/lib/repo/media";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const source = (["upload", "url", "youtube"] as const).includes(
    sp.source as "upload" | "url" | "youtube",
  )
    ? (sp.source as "upload" | "url" | "youtube")
    : "all";

  const { items, total } = listMedia({ source, search: sp.q, limit: 120 });
  const usage = Object.fromEntries(items.map((m) => [m.id, mediaUsage(m.id)]));

  return (
    <>
      <PageHeader
        title="Media library"
        description="Every image and video you’ve added. Editing alt text here updates it everywhere that item is used."
      />
      <MediaLibrary
        items={items}
        total={total}
        usage={usage}
        activeSource={source}
        query={sp.q ?? ""}
      />
    </>
  );
}
