import { notFound } from "next/navigation";
import { ProjectEditor } from "@/components/admin/ProjectEditor";
import { getProjectById } from "@/lib/repo/projects";
import { listCategories, listTools } from "@/lib/repo/content";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, categories, tools] = await Promise.all([
    getProjectById(id),
    listCategories(),
    listTools(),
  ]);
  if (!project) notFound();

  return (
    <ProjectEditor
      project={project}
      categories={categories}
      tools={tools}
    />
  );
}
