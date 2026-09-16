"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { pad2 } from "@/lib/format";
import type { UiLabels } from "@/lib/types";

type NavChapter = { key: string; label: string; index: number; href: string };

/**
 * The portrait's top edge clears this header by ~2rem when the page is at rest,
 * so at rest the header is transparent over Cream alone. Scrolling closes that
 * gap in about 32px, well before the PRD's original 80px threshold — which left
 * a band of scrolling where the links sat over the photo with nothing behind
 * them. Going opaque at 24px keeps the header readable over the portrait while
 * still reading as transparent at rest, which is what §6.2 is protecting.
 */
const SOLID_AFTER_PX = 24;

/**
 * PRD §6.2 — transparent over the hero; once scrolling starts it gains a Cream
 * background and a 1 px line border. On mobile it hides while scrolling down and
 * reappears when scrolling up.
 */
export function SiteNav({
  chapters,
  labels,
  availability,
  wordmark,
}: {
  chapters: NavChapter[];
  labels: UiLabels;
  availability: { label: string; status: "open" | "limited" | "closed"; href: string } | null;
  wordmark: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const lastY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > SOLID_AFTER_PX);
      setHidden(y > 200 && y > lastY.current);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mark the chapter currently in view (aria-current).
  useEffect(() => {
    const ids = chapters.map((c) => c.href).filter((h) => h.startsWith("#")).map((h) => h.slice(1));
    if (ids.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrent(`#${visible.target.id}`);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [chapters]);

  // Focus trap + Esc for the mobile overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      } else if (e.key === "Tab") {
        const items = panelRef.current?.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])');
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Only the slide transitions. The background used to fade over 300ms,
          which lost a race: a fast flick puts the portrait behind the header in
          ~80ms, leaving the links over the photo while the Cream was still 3%
          opaque. Snapping costs nothing to look at — Cream over a Cream hero is
          invisible, so what actually appears is the 1px border. */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ${
          scrolled || open ? "border-b border-line bg-cream" : "border-b border-transparent"
        } ${hidden && !open ? "-translate-y-full" : "translate-y-0"}`}
      >
        <div className="page">
          <div className="gutter flex h-16 items-center justify-between gap-4 lg:h-20">
            {/* The padding on these is hit area, not spacing: the row is a fixed
                h-16/lg:h-20 with items centred, so it grows the tappable box to
                ~44px without moving anything. The chapter links matter most —
                the desktop nav appears from `md`, which is an iPad's portrait
                width, where a 16px-tall link is a touch target. */}
            <Link
              href="/"
              className="py-2.5 font-display text-[18px] font-bold tracking-tight text-ink"
            >
              {wordmark}
            </Link>

            <nav aria-label="Chapters" className="hidden items-center gap-6 md:flex">
              {chapters.map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  aria-current={current === c.href ? "true" : undefined}
                  className={`t-index py-3.5 transition-colors hover:text-ember ${
                    current === c.href ? "text-ember" : "text-ink"
                  }`}
                >
                  <span className="text-muted">{pad2(c.index)}/</span> {c.label}
                </Link>
              ))}
              {availability ? (
                <Link
                  href={availability.href}
                  className={`tap-44 rounded-full border-2 px-4 py-1 text-[14px] font-semibold uppercase tracking-[0.04em] transition-colors ${
                    availability.status === "closed"
                      ? "border-line text-muted"
                      : "border-signal text-ink hover:bg-signal-tint"
                  }`}
                >
                  {availability.label}
                </Link>
              ) : null}
            </nav>

            <button
              ref={toggleRef}
              type="button"
              className="chip md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : labels.menu}
            </button>
          </div>
        </div>
      </header>

      {/* The overlay is a sibling of the header on purpose: the header carries a
          transform, which would otherwise make it the containing block for this
          fixed element and collapse it to the header's own height. */}
      {open ? (
        <div
          id="mobile-menu"
          ref={panelRef}
          className="fixed bottom-0 left-0 right-0 top-16 z-40 flex flex-col gap-8 overflow-y-auto bg-cream px-[var(--gutter)] pb-12 pt-8 md:hidden"
        >
          <nav aria-label="Chapters">
            <ul className="space-y-4">
              {chapters.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    onClick={() => setOpen(false)}
                    aria-current={current === c.href ? "true" : undefined}
                    className={`t-display-l block py-1 ${
                      current === c.href ? "text-signal" : "text-ink"
                    }`}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {availability ? (
            <Link
              href={availability.href}
              onClick={() => setOpen(false)}
              className={`mt-auto inline-flex w-full items-center justify-center rounded-full border-[length:var(--stroke-brand)] px-6 py-3 text-center font-display text-lg font-extrabold uppercase tracking-[0.04em] ${
                availability.status === "closed"
                  ? "border-line text-muted"
                  : "border-signal text-signal"
              }`}
            >
              {availability.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
