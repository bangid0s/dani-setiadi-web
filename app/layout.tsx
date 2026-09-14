import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { getSettings } from "@/lib/repo/content";
import "./globals.css";

export function generateMetadata(): Metadata {
  const settings = getSettings();
  const favicon = settings.favicon?.storagePath ?? settings.favicon?.originalUrl;
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: {
      default: "Dani Setiadi — Graphic Designer & Illustrator",
      template: settings.siteTitlePattern.includes("%s")
        ? settings.siteTitlePattern
        : "%s — Dani Setiadi",
    },
    description: settings.metaDescription,
    icons: favicon ? { icon: favicon } : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
