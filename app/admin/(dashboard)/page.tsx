import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, StatusBadge, EmptyState } from "@/components/admin/form";
import { countProjects, listProjects } from "@/lib/repo/projects";
import { getSettings, listCategories } from "@/lib/repo/content";
import { listMedia } from "@/lib/repo/media";
import { NewProjectButton } from "@/components/admin/NewProjectButton";

export default async function OverviewPage() {
  const [counts, settings, { items: recent }, media, categories] = await Promise.all([
    countProjects(),
    getSettings(),
    listProjects({ status: "all", sort: "newest", limit: 6 }),
    listMedia({ limit: 1 }),
    listCategories(),
  ]);

  const a = settings.availability;
  const statusLabel =
    a.status === "open" ? "Open for work" : a.status === "limited" ? "Limited" : "Not taking work";

  const todo: { label: string; href: string }[] = [];
  if (!settings.contactEmail && !settings.whatsappE164)
    todo.push({ label: "Add an email address or WhatsApp number", href: "/admin/settings" });
  if (!settings.cvPath) todo.push({ label: "Upload your CV", href: "/admin/settings" });
  if (!settings.metaDescription)
    todo.push({ label: "Write the description that shows in Google", href: "/admin/settings" });
  if (!settings.ogImageId)
    todo.push({ label: "Choose the image shown when your link is shared", href: "/admin/settings" });
  if (counts.published === 0)
    todo.push({ label: "Publish your first project", href: "/admin/projects" });

  return (
    <>
      <PageHeader
        title="Overview"
        description="Everything on your site is edited here. Changes go live within seconds."
        actions={<NewProjectButton />}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* Counts read as a sentence about the portfolio, not three big numbers. */}
        <Card title="Your portfolio">
          <dl className="space-y-2.5">
            <CountRow label="Published" value={counts.published} href="/admin/projects?status=published" />
            <CountRow label="Drafts" value={counts.draft} href="/admin/projects?status=draft" />
            <CountRow label="Categories" value={categories.length} href="/admin/categories" />
            <CountRow label="Media items" value={media.total} href="/admin/media" />
          </dl>
        </Card>

        <Card title="Availability" description="Shown in the menu bar and your About chapter.">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span
              aria-hidden="true"
              className={`size-2.5 rounded-full ${
                a.status === "open" ? "bg-signal" : a.status === "limited" ? "bg-ember" : "bg-muted"
              }`}
            />
            {statusLabel}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            Visitors see “{a.label}”{a.caption ? ` — ${a.caption}` : ""}.
          </p>
          <Link href="/admin/settings#availability" className="adm-btn adm-btn-secondary mt-4">
            Change availability
          </Link>
        </Card>

        <Card title="Jump to">
          <ul className="space-y-1">
            {[
              ["Add a project", "/admin/projects"],
              ["Upload work", "/admin/media"],
              ["Edit the hero", "/admin/hero"],
              ["Edit your bio", "/admin/about"],
              ["Edit experience", "/admin/experience"],
            ].map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="-mx-2 flex items-center justify-between gap-2 rounded-[var(--radius-admin)] px-2 py-1.5 text-[14px] text-ink transition-colors hover:bg-surface"
                >
                  {label}
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5 text-muted">
                    <path d="M6 3.5 10.5 8 6 12.5" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {todo.length > 0 ? (
        <div className="mt-5">
          <Card
            title="Before you launch"
            description="A short list of things your site is still missing."
          >
            <ul className="space-y-1">
              {todo.map((t) => (
                <li key={t.label}>
                  <Link
                    href={t.href}
                    className="-mx-2 flex items-start gap-2.5 rounded-[var(--radius-admin)] px-2 py-1.5 text-[14px] text-ink transition-colors hover:bg-surface"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] size-1.5 shrink-0 rounded-full bg-signal"
                    />
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <div className="mt-5">
        <Card title="Recently edited">
          {recent.length === 0 ? (
            <EmptyState title="Nothing here yet" action={<NewProjectButton />}>
              Your projects will appear here as you add them.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/projects/${p.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-[var(--radius-admin)] px-2 py-2.5 transition-colors hover:bg-surface"
                  >
                    <span className="min-w-0 truncate text-[14px] text-ink">{p.title}</span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function CountRow({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[14px] text-muted">
        <Link href={href} className="hover:text-ink">
          {label}
        </Link>
      </dt>
      <dd className="font-display text-[18px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
