import { PageHeader } from "@/components/admin/PageHeader";
import { ToolsManager } from "@/components/admin/ToolsManager";
import { listTools } from "@/lib/repo/content";

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        title="Tools"
        description="The icons inside the Tools pill in your About chapter. Square PNG or SVG works best."
      />
      <ToolsManager tools={listTools()} />
    </>
  );
}
