import { IndexLabel, TwoToneHeading, ButtonPrimary, ButtonOutline, ExternalLinkIcon } from "@/components/site/primitives";
import { whatsappUrl, mailtoUrl } from "@/lib/format";
import type { ContactContent, Section, SiteSettings } from "@/lib/types";

/** PRD §7.5 — channels render as large h3 Ink text links with a Signal underline. */
export function Contact({
  section,
  settings,
}: {
  section: Section<ContactContent>;
  settings: SiteSettings;
}) {
  const c = section.content;
  const wa = whatsappUrl(settings.whatsappE164, settings.whatsappMessage);
  const mail = mailtoUrl(settings.contactEmail, "Project enquiry — via danisetiadi.com");

  const channels: { key: string; label: string; href: string; external: boolean }[] = [];
  if (c.showEmail && mail)
    channels.push({ key: "email", label: settings.contactEmail, href: mail, external: false });
  if (c.showWhatsApp && wa)
    channels.push({ key: "whatsapp", label: "WhatsApp", href: wa, external: true });
  if (c.showSocials) {
    for (const s of settings.socialLinks.filter((s) => s.showInContact)) {
      channels.push({
        key: `${s.platform}-${s.url}`,
        label: s.label || s.platform,
        href: s.url,
        external: true,
      });
    }
  }

  const primaryHref = c.primaryChannel === "email" ? mail : wa;
  const primaryLabel = c.primaryChannel === "email" ? "Send an email" : "Chat on WhatsApp";

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="gutter py-[var(--section-y)]"
    >
      <IndexLabel index={section.index} label={section.label} />

      <div className="mt-8 grid gap-x-[clamp(1.5rem,4cqi,4rem)] gap-y-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-6">
          <TwoToneHeading id="contact-heading" lead={c.lead} keyword={c.keyword} />
          {c.text ? <p className="t-lead measure mt-8 text-body">{c.text}</p> : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {primaryHref ? (
              <ButtonPrimary
                href={primaryHref}
                external={c.primaryChannel === "whatsapp"}
                data-analytics={c.primaryChannel === "email" ? "cta_email" : "cta_whatsapp"}
              >
                {primaryLabel}
              </ButtonPrimary>
            ) : null}
            {c.showCv && settings.cvPath ? (
              <ButtonOutline href={settings.cvPath} external data-analytics="cv_download">
                {settings.uiLabels.downloadCv}
              </ButtonOutline>
            ) : null}
          </div>
        </div>

        {channels.length > 0 ? (
          <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:pt-[clamp(1rem,4cqi,3rem)]">
            <ul className="divide-y divide-line border-t border-line">
              {/* The row's padding lives on the anchor, not the li, so the whole
                  row is tappable rather than just the 25px of text, and `flex`
                  spans it the full width for the hover and tap area. The list
                  comes out 4px shorter than it was: the anchor no longer sits on
                  the li's text baseline, so it sheds that line's leading. That
                  was incidental space, not spacing anyone chose. */}
              {channels.map((ch, i) => (
                <li key={ch.key}>
                  <a
                    href={ch.href}
                    className={`text-link t-h3 flex items-center gap-2 ${
                      i === 0 ? "pb-3 lg:pb-4" : "py-3 lg:py-4"
                    }`}
                    {...(ch.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    data-analytics={ch.key === "whatsapp" ? "cta_whatsapp" : ch.key === "email" ? "cta_email" : undefined}
                  >
                    {ch.label}
                    {ch.external ? <ExternalLinkIcon className="size-[0.5em]" /> : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
