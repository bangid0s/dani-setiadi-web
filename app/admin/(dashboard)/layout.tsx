import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/admin/auth-actions";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * The dashboard is per-user by definition, so there is nothing to prerender.
 * Saying so up front keeps the build from spending a worker on each admin page
 * only to discover it reads cookies.
 */
export const dynamic = "force-dynamic";

/** ADM-01 — /admin/** requires login. The gate runs before anything renders. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");

  const initials =
    (user.name || user.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "D";

  return (
    <div className="lg:flex">
      <AdminNav />

      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[72rem] items-center justify-between gap-3 px-5 lg:px-10">
            {/* The page title lives in the page itself, so the bar carries
                identity on mobile and account actions everywhere. */}
            <Link
              href="/admin"
              className="font-display text-[15px] font-bold tracking-tight text-ink lg:hidden"
            >
              Dani Setiadi
            </Link>
            <span className="hidden min-w-0 items-center gap-2 lg:flex">
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full bg-signal-tint text-[11px] font-bold text-ink"
              >
                {initials}
              </span>
              <span className="truncate text-[13px] text-muted">{user.email}</span>
            </span>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/" target="_blank" className="adm-btn adm-btn-secondary">
                View site
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="adm-btn adm-btn-ghost">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[72rem] px-5 py-7 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
