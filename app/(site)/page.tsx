import type { Metadata } from "next";
import { Hero } from "@/components/site/Hero";
import { About } from "@/components/site/About";
import { Contact } from "@/components/site/Contact";
import { WorkGallery } from "@/components/site/WorkGallery";
import { FeaturedRows } from "@/components/site/FeaturedRows";
import { IndexLabel, TwoToneHeading } from "@/components/site/primitives";
import {
  listSections, getSettings, listTools, listExperiences, listActiveCategories,
} from "@/lib/repo/content";
import { getMedia } from "@/lib/repo/media";
import { galleryProjects, featuredProjects, toGalleryItems, availabilityHref } from "@/lib/site-data";
import { whatsappUrl, mailtoUrl } from "@/lib/format";
import type {
  AboutContent, ContactContent, HeroContent, Section, WorkContent,
} from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, sections] = await Promise.all([getSettings(), listSections()]);
  const hero = sections.find((s) => s.key === "hero")?.content as HeroContent | undefined;
  const name = hero?.displayName ?? "Dani Setiadi";
  const title = `${name} — ${hero?.roleLine ?? "Graphic Designer & Illustrator"}`;
  const ogImage = settings.ogImage?.storagePath ?? settings.ogImage?.originalUrl;
  return {
    title,
    description: settings.metaDescription,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description: settings.metaDescription,
      type: "profile",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: settings.metaDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function HomePage() {
  const [settings, sections, categories, tools, experiences] = await Promise.all([
    getSettings(),
    listSections({ visibleOnly: true }),
    listActiveCategories(),
    listTools({ visibleOnly: true }),
    listExperiences({ visibleOnly: true }),
  ]);

  const hero = sections.find((s) => s.key === "hero") as Section<HeroContent> | undefined;
  const work = sections.find((s) => s.key === "work") as Section<WorkContent> | undefined;
  const about = sections.find((s) => s.key === "about") as Section<AboutContent> | undefined;
  const contact = sections.find((s) => s.key === "contact") as Section<ContactContent> | undefined;

  const [featured, items, portrait, greetingSvg] = await Promise.all([
    work?.content.showFeatured ? featuredProjects() : [],
    galleryProjects(settings.gallery.includeFeatured).then(toGalleryItems),
    getMedia(hero?.content.portraitId),
    getMedia(hero?.content.greetingSvgId),
  ]);

  const wa = whatsappUrl(settings.whatsappE164, settings.whatsappMessage);
  const mail = mailtoUrl(settings.contactEmail);
  const availHref = availabilityHref(settings.availability.linkTarget, { whatsapp: wa, email: mail });

  // SEO-04 — JSON-LD Person on the home page.
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: hero?.content.displayName ?? "Dani Setiadi",
    jobTitle: hero?.content.roleLine ?? "Graphic Designer & Illustrator",
    address: { "@type": "PostalAddress", addressLocality: "Semarang", addressCountry: "ID" },
    image: portrait?.storagePath ?? portrait?.originalUrl ?? undefined,
    email: settings.contactEmail || undefined,
    sameAs: settings.socialLinks.map((s) => s.url),
  };

  // GLB-01 — chapters render in the admin-defined order; hidden ones are not
  // rendered at all.
  const chapters = sections.map((section) => {
    switch (section.key) {
      case "hero":
        return (
          <Hero
            key="hero"
            section={section as Section<HeroContent>}
            portrait={portrait}
            greetingSvg={greetingSvg}
          />
        );
      case "work": {
        const c = section.content as WorkContent;
        if (items.length === 0 && featured.length === 0) return null; // §7.3.3 empty state
        return (
          <section
            key="work"
            id="work"
            aria-labelledby="work-heading"
            className="gutter py-[var(--section-y)]"
          >
            <IndexLabel index={section.index} label={section.label} />
            <div className="mt-8">
              <TwoToneHeading id="work-heading" lead={c.lead} keyword={c.keyword} />
            </div>
            {c.intro ? <p className="t-lead measure mt-6 text-body">{c.intro}</p> : null}

            {featured.length > 0 ? (
              <div className="mt-12">
                <FeaturedRows projects={featured} labels={settings.uiLabels} />
              </div>
            ) : null}

            {items.length > 0 ? (
              <div className="mt-14">
                <WorkGallery
                  items={items}
                  categories={categories}
                  settings={settings.gallery}
                  labels={settings.uiLabels}
                  pageSize={settings.gallery.pageSize.home}
                  seeAllHref="/work"
                  seeAllLabel={c.seeAllLabel}
                />
              </div>
            ) : null}
          </section>
        );
      }
      case "about":
        return (
          <About
            key="about"
            section={section as Section<AboutContent>}
            tools={tools}
            experiences={experiences}
            settings={settings}
            availabilityHref={availHref}
          />
        );
      case "contact":
        return <Contact key="contact" section={section as Section<ContactContent>} settings={settings} />;
      default:
        return null;
    }
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />
      {chapters}
      {!hero && !work && !about && !contact ? (
        <div className="gutter py-24">
          <p className="t-lead text-muted">
            No chapters are visible. Turn them on in the dashboard under Sections.
          </p>
        </div>
      ) : null}
    </>
  );
}
