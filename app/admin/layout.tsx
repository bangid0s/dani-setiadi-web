import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Dani Setiadi",
  // SEO-02 — the dashboard is never indexed.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-cream">{children}</div>;
}
