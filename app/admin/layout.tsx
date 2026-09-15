import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Dani Setiadi",
  // SEO-02 — the dashboard is never indexed.
  robots: { index: false, follow: false },
};

// Nothing under /admin can be prerendered: it all depends on the session.
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-cream">{children}</div>;
}
