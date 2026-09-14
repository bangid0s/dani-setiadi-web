import { PageHeader } from "@/components/admin/PageHeader";
import { SectionsManager } from "@/components/admin/SectionsManager";
import { listSections } from "@/lib/repo/content";

export default function SectionsPage() {
  return (
    <>
      <PageHeader
        title="Sections"
        description="Drag chapters into the order you want, rename their labels and hide the ones you don’t need. The numbers update by themselves."
      />
      <SectionsManager sections={listSections()} />
    </>
  );
}
