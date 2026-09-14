import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[26rem]">
        <div className="adm-card overflow-hidden">
          {/* A thin signal rule instead of a two-tone heading — the two-tone
              treatment belongs to the site's chapters, not to a sign-in box. */}
          <div aria-hidden="true" className="h-1 bg-signal" />
          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <p className="adm-eyebrow">Dani Setiadi</p>
            <h1 className="mt-1 font-display text-[26px] font-bold leading-tight tracking-tight text-ink">
              Sign in to your dashboard
            </h1>
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
