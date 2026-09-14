import type { MetadataRoute } from "next";
import { listProjects } from "@/lib/repo/projects";

const base = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const { items } = listProjects({ status: "published" });
  const root = base();
  return [
    { url: `${root}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${root}/work`, changeFrequency: "weekly", priority: 0.8 },
    ...items.map((p) => ({
      url: `${root}/work/${p.slug}`,
      lastModified: new Date(p.updatedAt || p.createdAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
