import { PageHeader } from "@/components/admin/PageHeader";
import { ProjectsTable } from "@/components/admin/ProjectsTable";
import { NewProjectButton } from "@/components/admin/NewProjectButton";
import { BulkUpload } from "@/components/admin/BulkUpload";
import { listProjects } from "@/lib/repo/projects";
import { listCategories } from "@/lib/repo/content";
import type { ProjectStatus } from "@/lib/types";
import { FormSuccess } from "@/components/admin/form";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const status = (["draft", "published", "archived"] as const).includes(sp.status as ProjectStatus)
    ? (sp.status as ProjectStatus)
    : "all";

  const [{ items }, categories] = await Promise.all([
    listProjects({ status, categorySlug: sp.category ?? null, search: sp.q }),
    listCategories(),
  ]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Your portfolio. Drag to set the order visitors see, star up to three as featured."
        actions={<NewProjectButton />}
      />
      <div className="space-y-6">
        {sp.msg && <FormSuccess message={sp.msg} />}
        <ProjectsTable
          projects={items}
          categories={categories}
          activeStatus={status}
          activeCategory={sp.category ?? ""}
          query={sp.q ?? ""}
        />
        <BulkUpload categories={categories} />
      </div>
    </>
  );
}
