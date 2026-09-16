import Image from "next/image";
import { IndexLabel, TwoToneHeading, DotBullet, ButtonOutline, StatusPill } from "@/components/site/primitives";
import { RichInline } from "@/lib/richtext";
import { formatDateRange } from "@/lib/format";
import type { AboutContent, Experience, Section, SiteSettings, Tool } from "@/lib/types";

/** PRD §7.4 — "Let's Connect". The right column starts lower than the left. */
export function About({
  section,
  tools,
  experiences,
  settings,
  availabilityHref,
}: {
  section: Section<AboutContent>;
  tools: Tool[];
  experiences: Experience[];
  settings: SiteSettings;
  availabilityHref: string;
}) {
  const c = section.content;
  const a = settings.availability;
  const showPill =
    c.showAvailability && !(a.status === "closed" && a.hideWhenClosed);
  const wideTools = tools.length > 6;

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="gutter py-[var(--section-y)]"
    >
      <IndexLabel index={section.index} label={section.label} />

      <div className="mt-8 grid gap-x-[clamp(1.5rem,4cqi,4rem)] gap-y-12 lg:grid-cols-12">
        {/* Left column — heading, bio, tools, CV. min-w-0 keeps a wide child
            (the tools row) from forcing the grid track past the viewport. */}
        <div className="min-w-0 lg:col-span-6">
          <TwoToneHeading id="about-heading" lead={c.lead} keyword={c.keyword} />

          {c.bio ? (
            <RichInline
              text={c.bio}
              className="rich-text t-lead measure mt-8 text-body"
            />
          ) : null}

          {c.showTools && tools.length > 0 ? (
            <div
              className={`mt-10 inline-flex max-w-full items-center gap-x-4 gap-y-3 border-[length:var(--stroke-brand)] border-signal px-5 py-3.5 max-md:flex-col max-md:items-start lg:gap-x-5 lg:px-6 lg:py-4 ${
                wideTools ? "flex-wrap rounded-[40px]" : "rounded-full"
              }`}
            >
              <span className="t-h3 shrink-0 text-ink">{c.toolsLabel}</span>
              <ul className="flex min-w-0 flex-wrap items-center gap-3 lg:gap-4">
                {tools.map((tool) => (
                  <li key={tool.id} className="shrink-0">
                    {tool.icon?.storagePath || tool.icon?.originalUrl ? (
                      <Image
                        src={tool.icon.storagePath ?? tool.icon.originalUrl!}
                        alt={tool.name}
                        title={tool.name}
                        width={56}
                        height={56}
                        unoptimized={tool.icon.isHotlinked || tool.icon.mimeType === "image/svg+xml"}
                        className="tool-icon object-contain"
                      />
                    ) : (
                      <span
                        title={tool.name}
                        className="tool-icon flex items-center justify-center rounded-lg bg-surface text-[clamp(0.75rem,1.6cqi,0.9375rem)] font-semibold text-ink"
                      >
                        {initials(tool.name)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {settings.cvPath ? (
            <div className="mt-8">
              <ButtonOutline href={settings.cvPath} external data-analytics="cv_download">
                {c.cvLabel || settings.uiLabels.downloadCv}
              </ButtonOutline>
            </div>
          ) : null}
        </div>

        {/* Right column — starts lower than the left (the reference's stagger) */}
        <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:pt-[clamp(2rem,6cqi,5rem)]">
          {showPill ? (
            <div className="lg:text-right">
              <StatusPill label={a.label} status={a.status} href={availabilityHref} />
              {a.caption ? (
                <p className="mt-2.5 font-display text-[15px] font-bold text-ink lg:text-base">
                  {a.caption}
                </p>
              ) : null}
            </div>
          ) : null}

          {experiences.length > 0 ? (
            <div className={showPill ? "mt-12" : ""}>
              <h3 className="t-h2 text-ink">{c.experienceHeading}</h3>
              <ul className="mt-6 space-y-[clamp(2.5rem,4cqi,3.5rem)]">
                {experiences.map((e) => (
                  <li key={e.id} className="flex gap-3 lg:gap-4">
                    <DotBullet className="mt-[0.35em]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <h4 className="t-label-caps text-ink">{e.company}</h4>
                        <span className="t-label-year shrink-0 text-ink">
                          {formatDateRange(e)}
                        </span>
                      </div>
                      <p className="t-meta mt-1 text-ink">
                        {[e.role, e.workType].filter(Boolean).join(" – ")}
                      </p>
                      {e.description ? (
                        <p className="t-body measure-tight mt-2 text-body">{e.description}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
