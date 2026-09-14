import Link from "next/link";
import { getSettings } from "@/lib/repo/content";

/**
 * PRD §7.7 — the script "Oops," over a huge "404" in Signal.
 * Rendered inside the root layout, so it carries no html/body of its own.
 */
export default function NotFound() {
  const labels = getSettings().uiLabels;

  return (
    <div className="page">
      <main className="gutter flex min-h-svh flex-col justify-center py-24">
        <p
          aria-hidden="true"
          className="font-script text-ink"
          style={{ fontSize: "clamp(2.5rem, 7cqi, 6rem)", lineHeight: 0.9 }}
        >
          {labels.notFoundLead}
        </p>
        <h1 className="t-display-name mt-2 text-signal">
          <span className="sr-only">{labels.notFoundLead} </span>
          {labels.notFoundKeyword}
        </h1>
        <p className="t-lead measure mt-8 text-body">{labels.notFoundText}</p>
        <div className="mt-8">
          <Link href="/" className="btn-outline">
            {labels.notFoundCta}
          </Link>
        </div>
      </main>
    </div>
  );
}
