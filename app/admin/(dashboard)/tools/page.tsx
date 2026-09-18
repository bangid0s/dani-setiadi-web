import { PageHeader } from "@/components/admin/PageHeader";
import { ToolsManager } from "@/components/admin/ToolsManager";
import { listTools } from "@/lib/repo/content";

import { FormSuccess } from "@/components/admin/form";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Tools"
        description="The icons inside the Tools pill in your About chapter. Square PNG or SVG works best."
      />
      {sp.msg && <FormSuccess message={sp.msg} />}
      <ToolsManager tools={await listTools()} />
    </>
  );
}
