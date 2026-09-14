"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validation";
import {
  findAdminByEmail, verifyPassword, startSession, endSession,
  isRateLimited, recordFailedAttempt, clearAttempts,
} from "@/lib/auth";

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const { email, password } = parsed.data;
  const key = email.toLowerCase();

  // ADM-04 — temporary lockout after repeated failures.
  if (await isRateLimited(key)) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const user = await findAdminByEmail(email);
  // ADM-02 — only allow-listed users get in. The message stays identical for an
  // unknown email and a wrong password, so it can't be used to probe accounts.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    await recordFailedAttempt(key);
    return { error: "That email and password don’t match." };
  }

  await clearAttempts(key);
  await startSession(user.userId);
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}
