import type { Metadata } from "next";
import { WorkGallery } from "@/components/site/WorkGallery";
import { IndexLabel, TwoToneHeading } from "@/components/site/primitives";
import { listSections, getSettings, listActiveCategories } from "@/lib/repo/content";
import { galleryProjects, toGalleryItems } from "@/lib/site-data";
import type { Section, WorkContent } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings.siteTitlePattern.includes("%s")
    ? settings.siteTitlePattern.replace("%s", "Work")
    : "Work";
  return {
    title,
    description: settings.metaDescription,
    alternates: { canonical: "/work" },
  };
}

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const settings = await getSettings();
  const section = (await listSections()).find((s) => s.key === "work") as Section<WorkContent> | undefined;
  const c = section?.content;

  // /work shows everything, featured included.
  const items = await toGalleryItems(await galleryProjects(true));
  const categories = await listActiveCategories();
  const initialCategory = categories.some((x) => x.slug === category) ? (category ?? null) : null;

  return (
    <section className="gutter py-[calc(var(--section-y)+4rem)]">
      <IndexLabel index={section?.index ?? 2} label={section?.label ?? "Work"} />
      <div className="mt-6">
        <TwoToneHeading
          as="h1"
          lead={c?.lead ?? "Selected"}
          keyword={c?.keyword ?? "Work"}
        />
      </div>
      {c?.intro ? <p className="t-lead measure mt-6 text-body">{c.intro}</p> : null}

      <div className="mt-12">
        <WorkGallery
          items={items}
          categories={categories}
          settings={settings.gallery}
          labels={settings.uiLabels}
          pageSize={settings.gallery.pageSize.work}
          urlSync
          initialCategory={initialCategory}
        />
      </div>
    </section>
  );
}
