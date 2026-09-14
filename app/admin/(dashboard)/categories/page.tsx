import { PageHeader } from "@/components/admin/PageHeader";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { listCategories } from "@/lib/repo/content";
import { listProjects } from "@/lib/repo/projects";

export default async function CategoriesPage() {
  const categories = await listCategories();
  const { items } = await listProjects({ status: "all" });
  const counts = Object.fromEntries(
    categories.map((c) => [c.id, items.filter((p) => p.categories.some((x) => x.id === c.id)).length]),
  );
  return (
    <>
      <PageHeader
        title="Categories"
        description="These become the filter chips on your work page. Only categories with published work are shown to visitors."
      />
      <CategoriesManager categories={categories} counts={counts} />
    </>
  );
}
