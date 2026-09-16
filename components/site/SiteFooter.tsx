import Link from "next/link";
import { ExternalLinkIcon } from "@/components/site/primitives";
import type { SiteSettings } from "@/lib/types";

/** PRD GLB-04 — © year, socials, back to top, optional credit line. */
export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  const socials = settings.socialLinks.filter((s) => s.showInFooter);

  return (
    <footer className="gutter border-t border-line py-10 lg:py-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="t-meta text-muted">© {year} Dani Setiadi</p>
          {settings.uiLabels.showFooterCredit && settings.uiLabels.footerCredit ? (
            <p className="t-meta text-muted">{settings.uiLabels.footerCredit}</p>
          ) : null}
        </div>

        {socials.length > 0 ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-center">
            {socials.map((s) => (
              <li key={`${s.platform}-${s.url}`}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-44 t-meta inline-flex items-center gap-1 text-ink hover:text-ember"
                >
                  {s.label || s.platform}
                  <ExternalLinkIcon className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <Link
          href="#top"
          className="tap-44 t-meta inline-flex items-center gap-1.5 text-ink hover:text-ember sm:justify-end"
        >
          {settings.uiLabels.backToTop}
          <span aria-hidden="true">↑</span>
        </Link>
      </div>
    </footer>
  );
}
