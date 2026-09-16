import { IndexLabel, MapPinIcon } from "@/components/site/primitives";
import { MediaImage } from "@/components/media/MediaImage";
import type { HeroContent, Media, Section } from "@/lib/types";

/**
 * PRD §7.2 — the hero.
 *
 * Stacking order (§5.4): portrait (z1) → name (z2) → greeting (z3).
 * The name sits in FRONT of the portrait's lower third; the greeting's crossbar
 * runs off the viewport's left edge, outside the container.
 */
export function Hero({
  section,
  portrait,
  greetingSvg,
}: {
  section: Section<HeroContent>;
  portrait: Media | null;
  greetingSvg: Media | null;
}) {
  const c = section.content;

  // HERO-03 — the name always fits. The name is always rendered as separate
  // parts; CSS decides inline vs stacked, so "auto" can react to the viewport
  // (two lines below 640px) as well as to the name's length (over 14 chars).
  const words = c.displayName.trim().split(/\s+/);
  const canSplit = words.length > 1;
  const nameParts = canSplit ? [words[0], words.slice(1).join(" ")] : [c.displayName];
  const layout =
    !canSplit
      ? "one-line"
      : c.nameLayout === "auto" && c.displayName.length > 14
        ? "two-lines"
        : c.nameLayout;

  // HERO-01 — from `xl` up the portrait is sized by the frame's HEIGHT, not its
  // width. Below that, width is the scarce axis and the width classes rule; but
  // a wide viewport grows the hero to 100svh while a width-capped portrait stops
  // growing, which left a tall band of empty cream above the photo. Deriving the
  // width from the frame's height and the image's own ratio keeps the portrait
  // filling the frame at any window size. The `vw` term guards a square or
  // landscape crop from spanning the viewport; `7rem` clears the fixed nav.
  const ratio = portrait && portrait.height > 0 ? portrait.width / portrait.height : 0.75;
  const portraitWidth = `min(48vw, calc((min(100svh, 1080px) - 7rem) * ${ratio}))`;

  return (
    <section
      id="intro"
      aria-labelledby="hero-heading"
      className="relative flex min-h-[min(100svh,1080px)] flex-col overflow-x-clip"
    >
      {/* Top row — index left; role + location right-aligned in the right column.
          Padded clear of the fixed nav, which is transparent over the hero. */}
      <div className="gutter relative z-20 grid grid-cols-1 gap-4 pt-24 sm:grid-cols-12 lg:pt-28">
        <div className="sm:col-span-5">
          <IndexLabel index={section.index} label={section.label} />
        </div>
        <div className="sm:col-span-7 sm:text-right">
          {c.roleLine ? (
            <p className="font-display text-[clamp(1rem,1.6cqi,1.3rem)] font-bold leading-tight text-ink">
              {c.roleLine}
            </p>
          ) : null}
          {c.locationLine ? (
            <p className="mt-1 flex items-start gap-1.5 text-[clamp(1rem,1.6cqi,1.3rem)] leading-snug text-ink sm:justify-end">
              {c.showLocationIcon ? (
                <MapPinIcon className="mt-[0.2em] size-[1em] shrink-0 text-signal" />
              ) : null}
              <span className="sm:max-w-[24ch]">{c.locationLine}</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* z1 — the portrait runs to the hero's bottom edge, centred at ~53% of
          the width, so the name (z2) crosses its lower third (PRD §5.4). */}
      <div
        aria-hidden={portrait ? undefined : "true"}
        className="pointer-events-none absolute inset-x-0 bottom-0 top-16 z-10 flex items-end justify-center"
      >
        {portrait ? (
          <div
            className="anim-portrait absolute bottom-0 w-[85%] max-w-[560px] sm:w-[46%] lg:w-[40%] xl:w-[var(--portrait-w)] xl:max-w-none"
            style={{
              left: `${c.portraitPosition?.x ?? 53}%`,
              transform: `translateX(-50%) scale(${c.portraitScale ?? 1})`,
              transformOrigin: "bottom center",
              ["--portrait-w" as string]: portraitWidth,
            }}
          >
            <div className="portrait-shadow">
              <MediaImage
                media={portrait}
                fill={false}
                priority
                sizes="(max-width: 640px) 85vw, (max-width: 1280px) 46vw, 48vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        ) : (
          <div className="absolute bottom-0 left-1/2 h-[58%] w-[70%] max-w-[480px] -translate-x-1/2 bg-surface" />
        )}
      </div>

      {/* z2/z3 — type block, in front of the portrait. The name's baseline sits
          ~9% of the hero height above the bottom edge. */}
      <div className="gutter relative z-20 mt-auto pb-[9%]">
        <div className="relative">
          <span className="anim-greeting pointer-events-none absolute bottom-full left-0 z-30 block translate-y-[0.15em]">
            {c.greetingMode === "svg" && greetingSvg ? (
              <span aria-hidden="true" className="block w-[clamp(140px,26cqi,420px)]">
                <MediaImage
                  media={greetingSvg}
                  fill={false}
                  priority
                  sizes="(max-width: 640px) 40vw, 26vw"
                />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="block font-script text-ink"
                style={{ fontSize: "clamp(2.75rem, 8cqi, 7rem)", lineHeight: 0.9 }}
              >
                {c.greetingText}
              </span>
            )}
          </span>

          <h1 id="hero-heading" className="mask-clip relative">
            {/* HERO-02 — the accessible name reads as one sentence. */}
            <span className="sr-only">
              {c.greetingText} {c.displayName}
            </span>
            <span
              aria-hidden="true"
              className="anim-name block t-display-name text-signal"
              data-layout={layout}
              style={{ ["--name-scale" as string]: c.nameScale ?? 1 }}
            >
              {nameParts.map((part, i) => (
                <span key={i} className="name-part">
                  {part}
                </span>
              ))}
            </span>
          </h1>
        </div>
      </div>
    </section>
  );
}
