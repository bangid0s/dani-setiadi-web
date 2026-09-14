import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { listSections, getSettings } from "@/lib/repo/content";
import { availabilityHref } from "@/lib/site-data";
import { whatsappUrl, mailtoUrl } from "@/lib/format";
import type { HeroContent } from "@/lib/types";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const sections = await listSections({ visibleOnly: true });
  const hero = sections.find((s) => s.key === "hero");
  const wordmark = hero ? (hero.content as HeroContent).displayName : "Dani Setiadi";

  // Chapter links and labels come from the Sections manager (PRD §6.2).
  const chapters = sections
    .filter((s) => s.key !== "hero")
    .map((s) => ({ key: s.key, label: s.label, index: s.index, href: `#${s.key}` }));

  const a = settings.availability;
  const showPill = !(a.status === "closed" && a.hideWhenClosed);

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-full bg-ink px-4 py-2 text-cream focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
      >
        {settings.uiLabels.skipToContent}
      </a>
      <SiteNav
        chapters={chapters}
        labels={settings.uiLabels}
        wordmark={wordmark}
        availability={
          showPill
            ? {
                label: a.label,
                status: a.status,
                href: availabilityHref(a.linkTarget, {
                  whatsapp: whatsappUrl(settings.whatsappE164, settings.whatsappMessage),
                  email: mailtoUrl(settings.contactEmail),
                }),
              }
            : null
        }
      />
      <div className="page" id="top">
        <main id="main">{children}</main>
        <SiteFooter settings={settings} />
      </div>
      {settings.showFloatingWhatsApp ? (
        <FloatingWhatsApp e164={settings.whatsappE164} message={settings.whatsappMessage} />
      ) : null}
    </>
  );
}
