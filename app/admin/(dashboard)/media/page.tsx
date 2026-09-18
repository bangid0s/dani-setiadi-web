import { PageHeader } from "@/components/admin/PageHeader";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { listMedia, mediaUsageMany } from "@/lib/repo/media";
import { FormSuccess } from "@/components/admin/form";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; q?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const source = (["upload", "url", "youtube"] as const).includes(
    sp.source as "upload" | "url" | "youtube",
  )
    ? (sp.source as "upload" | "url" | "youtube")
    : "all";

  const { items, total } = await listMedia({ source, search: sp.q, limit: 120 });
  const usage = await mediaUsageMany(items.map((m) => m.id));

  return (
    <>
      <PageHeader
        title="Media library"
        description="Every image and video you’ve added. Editing alt text here updates it everywhere that item is used."
      />
      {sp.msg && <FormSuccess message={sp.msg} />}
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
