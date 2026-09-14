"use client";

import { useTransition } from "react";
import { createProjectAction } from "@/app/admin/actions";

export function NewProjectButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => createProjectAction())}
      className="adm-btn adm-btn-primary"
    >
      {pending ? "Creating…" : "New project"}
    </button>
  );
}
