import { PageHeader } from "@/components/admin/PageHeader";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { listCategories } from "@/lib/repo/content";
import { countProjectsByCategory } from "@/lib/repo/projects";

import { FormSuccess } from "@/components/admin/form";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [sp, categories, perCategory] = await Promise.all([
    searchParams,
    listCategories(),
    countProjectsByCategory(),
  ]);
  const counts = Object.fromEntries(categories.map((c) => [c.id, perCategory[c.id] ?? 0]));
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
