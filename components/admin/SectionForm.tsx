"use client";

import { useActionState } from "react";
import { saveSectionAction, type ActionState } from "@/app/admin/actions";
import { FormError, FormSuccess, Submit, FormGuards } from "@/components/admin/form";
import type { SectionKey } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

/**
 * Shared wrapper for the four chapter editors. Singleton content uses
 * "Publish changes", which goes live immediately (PRD §9.2).
 */
export function SectionForm({
  sectionKey,
  children,
  label,
}: {
  sectionKey: SectionKey;
  children: React.ReactNode;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    saveSectionAction.bind(null, sectionKey),
    initial,
  );

  return (
    <form action={action} data-guard className="space-y-6">
      <FormGuards />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      {children}
      <div className="adm-actionbar -mx-5 px-5 lg:-mx-10 lg:px-10">
        <Submit pending={pending}>Publish changes</Submit>
        <span className="text-[13px] text-muted">
          Goes live straight away
          <span className="hidden sm:inline"> · ⌘S saves</span>
        </span>
        <span className="sr-only">{label}</span>
      </div>
    </form>
  );
}
