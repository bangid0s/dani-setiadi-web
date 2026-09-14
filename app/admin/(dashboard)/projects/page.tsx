import { PageHeader } from "@/components/admin/PageHeader";
import { ProjectsTable } from "@/components/admin/ProjectsTable";
import { NewProjectButton } from "@/components/admin/NewProjectButton";
import { BulkUpload } from "@/components/admin/BulkUpload";
import { listProjects } from "@/lib/repo/projects";
import { listCategories } from "@/lib/repo/content";
import type { ProjectStatus } from "@/lib/types";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = (["draft", "published", "archived"] as const).includes(sp.status as ProjectStatus)
    ? (sp.status as ProjectStatus)
    : "all";

  const { items } = listProjects({
    status,
    categorySlug: sp.category ?? null,
    search: sp.q,
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Your portfolio. Drag to set the order visitors see, star up to three as featured."
        actions={<NewProjectButton />}
      />
      <div className="space-y-6">
        <ProjectsTable
          projects={items}
          categories={listCategories()}
          activeStatus={status}
          activeCategory={sp.category ?? ""}
          query={sp.q ?? ""}
        />
        <BulkUpload categories={listCategories()} />
      </div>
    </>
  );
}
