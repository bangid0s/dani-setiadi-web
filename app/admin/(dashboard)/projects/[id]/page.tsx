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
  const project = getProjectById(id);
  if (!project) notFound();

  return (
    <ProjectEditor
      project={project}
      categories={listCategories()}
      tools={listTools()}
    />
  );
}
