import Link from "next/link";
import { MediaImage } from "@/components/media/MediaImage";
import { YouTubeFacade } from "@/components/media/YouTubeFacade";
import type { Project, UiLabels } from "@/lib/types";

/**
 * PRD §7.3.2 — up to 3 featured projects open the Work chapter.
 * Rows alternate sides on desktop and stack (media → text) on mobile.
 * Meta line: category left, year right-aligned (the Experience pattern).
 */
export function FeaturedRows({
  projects,
  labels,
}: {
  projects: Project[];
  labels: UiLabels;
}) {
  if (projects.length === 0) return null;

  return (
    <div className="space-y-[clamp(3rem,7cqi,6rem)]">
      {projects.slice(0, 3).map((project, i) => {
        const reversed = i % 2 === 1;
        const media = project.cover;
        const isVideo = media?.source === "youtube";
        const ratio = media ? media.width / media.height : 4 / 3;

        return (
          <article
            key={project.id}
            className="grid items-center gap-6 sm:grid-cols-12 sm:gap-[clamp(1.5rem,3cqi,3rem)]"
          >
            <div className={`sm:col-span-7 ${reversed ? "sm:order-2" : ""}`}>
              <div
                className="relative w-full bg-surface"
                style={{ aspectRatio: String(ratio), maxHeight: "80vh" }}
              >
                {isVideo && media ? (
                  <YouTubeFacade media={media} title={project.title} />
                ) : (
                  <Link href={`/work/${project.slug}`} className="group/card block h-full w-full">
                    <span className="card-media-frame block h-full w-full">
                      <MediaImage
                        media={media}
                        sizes="(max-width: 640px) 100vw, 58vw"
                        fallbackLabel={labels.imageUnavailable}
                      />
                    </span>
                  </Link>
                )}
              </div>
            </div>

            <div className={`sm:col-span-5 ${reversed ? "sm:order-1" : ""}`}>
              <p className="flex items-baseline justify-between gap-4">
                <span className="t-meta text-muted">
                  {project.categories[0]?.name ?? ""}
                </span>
                {project.year ? (
                  <span className="t-label-year text-ink">{project.year}</span>
                ) : null}
              </p>
              <h3 className="t-h2 mt-2 text-ink text-balance">
                <Link href={`/work/${project.slug}`} className="hover:text-ember">
                  {project.title}
                </Link>
              </h3>
              {project.summary ? (
                <p className="t-lead measure mt-4 text-body">{project.summary}</p>
              ) : null}
              <Link href={`/work/${project.slug}`} className="btn-outline mt-6">
                {labels.viewProject}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
