"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/auth-actions";
import { Field, Submit, FormError } from "@/components/admin/form";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: null as string | null });

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="username" required autoFocus />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Submit pending={pending} className="w-full">
        Sign in
      </Submit>
      <p className="text-[13px] leading-relaxed text-muted">
        Accounts are invite-only. If you can’t get in, ask whoever set the site up to reset your
        password.
      </p>
    </form>
  );
}
