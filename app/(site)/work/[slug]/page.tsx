import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaImage } from "@/components/media/MediaImage";
import { YouTubeFacade } from "@/components/media/YouTubeFacade";
import { DotBullet, ExternalLinkIcon, TwoToneHeading } from "@/components/site/primitives";
import { RichText, toPlainText } from "@/lib/richtext";
import { getProjectBySlug, projectNeighbours } from "@/lib/repo/projects";
import { getMedia } from "@/lib/repo/media";
import { getSettings } from "@/lib/repo/content";
import { pad2 } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug, { publishedOnly: true });
  if (!project) return { title: "Not found" };

  const settings = await getSettings();
  const title = project.seoTitle || project.title;
  const description =
    project.seoDescription || project.summary || toPlainText(project.body, 160) || settings.metaDescription;
  const share = await getMedia(project.ogImageId) ?? project.cover;
  const image = share?.storagePath ?? share?.originalUrl;

  return {
    title: settings.siteTitlePattern.includes("%s")
      ? settings.siteTitlePattern.replace("%s", title)
      : title,
    description,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: { title, description, type: "article", images: image ? [image] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // PROJ-01 — draft and archived projects return 404.
  const project = await getProjectBySlug(slug, { publishedOnly: true });
  const settings = await getSettings();
  const { next } = await projectNeighbours(slug);
  if (!project) notFound();
  const cover = project.cover;
  const coverIsVideo = cover?.source === "youtube";

  const meta: { label: string; value: React.ReactNode }[] = [];
  if (project.client) meta.push({ label: "Client", value: project.client });
  if (project.year) meta.push({ label: "Year", value: String(project.year) });
  if (project.role) meta.push({ label: "Role", value: project.role });
  if (project.tools.length)
    meta.push({ label: "Tools", value: project.tools.map((t) => t.name).join(", ") });

  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary ?? undefined,
    dateCreated: project.year ? String(project.year) : undefined,
    creator: { "@type": "Person", name: "Dani Setiadi" },
    image: cover?.storagePath ?? cover?.originalUrl ?? undefined,
  };

  return (
    <article className="gutter py-[calc(var(--section-y)+4rem)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkLd) }}
      />

      <nav aria-label="Breadcrumb" className="t-index text-muted">
        <Link href="/work" className="hover:text-ember">
          <span className="text-ink">{pad2(2)}/</span> Work
        </Link>
        {project.categories[0] ? <span> / {project.categories[0].name}</span> : null}
      </nav>

      <h1 className="t-display-xl mt-6 max-w-[16ch] text-balance text-ink">{project.title}</h1>

      {meta.length > 0 ? (
        <ul className="mt-8 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:max-w-3xl">
          {meta.map((m) => (
            <li key={m.label} className="flex items-baseline gap-3">
              <DotBullet className="translate-y-[-0.1em]" />
              <span className="t-meta w-16 shrink-0 text-muted">{m.label}</span>
              <span className="t-meta text-ink">{m.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {cover ? (
        <div
          className="mt-10 w-full bg-surface"
          style={{ aspectRatio: `${cover.width} / ${cover.height}`, maxHeight: "90vh" }}
        >
          {coverIsVideo ? (
            <YouTubeFacade media={cover} title={project.title} />
          ) : (
            <div className="relative h-full w-full">
              <MediaImage
                media={cover}
                sizes="(max-width: 1440px) 100vw, 1440px"
                priority
                fallbackLabel={settings.uiLabels.imageUnavailable}
                className="!object-contain"
              />
            </div>
          )}
        </div>
      ) : null}

      {project.summary ? (
        <p className="t-lead measure mt-10 text-body sm:w-7/12">{project.summary}</p>
      ) : null}

      {project.gallery.length > 0 ? (
        <div className="mt-14 grid grid-cols-1 gap-[var(--gallery-gap)] sm:grid-cols-2">
          {project.gallery.map((item) => {
            const m = item.media;
            const isVideo = m?.source === "youtube";
            const ratio = m ? m.width / m.height : 4 / 3;
            return (
              <figure
                key={item.id}
                className={item.width === "full" ? "sm:col-span-2" : "sm:col-span-1"}
              >
                <div className="relative w-full bg-surface" style={{ aspectRatio: String(ratio) }}>
                  {isVideo && m ? (
                    <YouTubeFacade media={m} title={item.caption ?? project.title} />
                  ) : (
                    <MediaImage
                      media={m}
                      sizes={item.width === "full" ? "(max-width: 1440px) 100vw, 1440px" : "(max-width: 640px) 100vw, 50vw"}
                      fallbackLabel={settings.uiLabels.imageUnavailable}
                      className="!object-contain"
                    />
                  )}
                </div>
                {item.caption ? (
                  <figcaption className="t-meta mt-2 text-muted">{item.caption}</figcaption>
                ) : null}
              </figure>
            );
          })}
        </div>
      ) : null}

      {project.body ? (
        <div className="mt-14 sm:w-7/12">
          <RichText text={project.body} className="rich-text t-body measure-tight text-body" />
        </div>
      ) : null}

      {project.links.length > 0 ? (
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
          {project.links.map((l) => (
            <li key={l.id}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link inline-flex items-center gap-1"
              >
                {l.label}
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {next && next.slug !== project.slug ? (
        <div className="mt-[var(--section-y)] border-t border-line pt-10">
          <TwoToneHeading lead="Next" keyword="project" />
          <Link href={`/work/${next.slug}`} className="t-h2 mt-4 inline-block text-ink hover:text-ember">
            {next.title}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
