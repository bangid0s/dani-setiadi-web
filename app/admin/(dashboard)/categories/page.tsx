import { PageHeader } from "@/components/admin/PageHeader";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { listCategories } from "@/lib/repo/content";
import { listProjects } from "@/lib/repo/projects";

import { FormSuccess } from "@/components/admin/form";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const sp = await searchParams;
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
      {sp.msg && <FormSuccess message={sp.msg} />}
      <CategoriesManager categories={categories} counts={counts} />
    </>
  );
}
