"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * PRD §9.2 — a sidebar on desktop; on mobile a bottom tab bar plus a "More"
 * sheet, so every P0 flow works at 375 px.
 *
 * The active item gets a signal rail and a tinted ground rather than a solid
 * orange block: it still reads instantly, without shouting over the content.
 */
type Item = { href: string; label: string; short?: string; primary?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Site",
    items: [
      { href: "/admin", label: "Overview", primary: true },
      { href: "/admin/sections", label: "Sections" },
    ],
  },
  {
    title: "Chapters",
    items: [
      { href: "/admin/hero", label: "Hero" },
      { href: "/admin/work", label: "Work" },
      { href: "/admin/about", label: "About" },
      { href: "/admin/contact", label: "Contact" },
    ],
  },
  {
    title: "Portfolio",
    items: [
      { href: "/admin/projects", label: "Projects", primary: true },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/display", label: "Display settings", short: "Display" },
    ],
  },
  {
    title: "Profile",
    items: [
      { href: "/admin/experience", label: "Experience" },
      { href: "/admin/tools", label: "Tools" },
    ],
  },
  {
    title: "Library",
    items: [{ href: "/admin/media", label: "Media library", short: "Media", primary: true }],
  },
  {
    title: "Settings",
    items: [{ href: "/admin/settings", label: "Settings" }],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const primaries = GROUPS.flatMap((g) => g.items).filter((i) => i.primary);

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Dashboard"
        className="hidden w-60 shrink-0 border-r border-line lg:block"
      >
        <div className="sticky top-0 max-h-svh overflow-y-auto px-4 py-6">
          <Link href="/admin" className="block px-2">
            <span className="block font-display text-[17px] font-bold leading-tight tracking-tight text-ink">
              Dani Setiadi
            </span>
            <span className="adm-eyebrow mt-0.5 block">Dashboard</span>
          </Link>

          <div className="mt-7 space-y-6">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <p className="adm-eyebrow px-2">{group.title}</p>
                <ul className="mt-2 space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`relative block rounded-[var(--radius-admin)] py-[7px] pl-3 pr-2 text-[14px] leading-snug transition-colors ${
                            active
                              ? "bg-signal-tint font-semibold text-ink"
                              : "text-ink/85 hover:bg-surface hover:text-ink"
                          }`}
                        >
                          {active ? (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-signal"
                            />
                          ) : null}
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile tab bar */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 border-t border-line bg-cream/95 backdrop-blur lg:hidden"
      >
        {primaries.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[12px] leading-none ${
                active ? "font-semibold text-ember" : "text-ink/80"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-[3px] w-6 rounded-full transition-colors ${
                  active ? "bg-signal" : "bg-transparent"
                }`}
              />
              {item.short ?? item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-controls="admin-more"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[12px] leading-none ${
            moreOpen ? "font-semibold text-ember" : "text-ink/80"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-[3px] w-6 rounded-full transition-colors ${
              moreOpen ? "bg-signal" : "bg-transparent"
            }`}
          />
          {moreOpen ? "Close" : "More"}
        </button>
      </nav>

      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-30 bg-ink/25 lg:hidden"
          />
          <div
            id="admin-more"
            className="fixed inset-x-0 bottom-14 z-40 max-h-[64svh] overflow-y-auto rounded-t-[var(--radius-card)] border-t border-line bg-cream px-5 pb-6 pt-4 shadow-[0_-8px_24px_rgb(19_24_43/0.08)] lg:hidden"
          >
            {GROUPS.map((group) => (
              <div key={group.title} className="mb-4 last:mb-0">
                <p className="adm-eyebrow">{group.title}</p>
                <ul className="mt-1.5 grid grid-cols-2 gap-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={`block rounded-[var(--radius-admin)] px-3 py-2.5 text-[14px] ${
                          isActive(item.href)
                            ? "bg-signal-tint font-semibold text-ink"
                            : "text-ink hover:bg-surface"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
