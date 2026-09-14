"use client";

import { useActionState, useState } from "react";
import {
  saveExperienceAction, deleteExperienceAction, reorderExperiencesAction, type ActionState,
} from "@/app/admin/actions";
import {
  Field, NumberField, Select, Toggle, Submit, Card, FormError, FormSuccess, MoveButtons,
} from "@/components/admin/form";
import { formatDateRange } from "@/lib/format";
import { LIMITS } from "@/lib/validation";
import type { Experience } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

const WORK_TYPES = ["Remote", "On-site", "Hybrid", "Freelance", "Contract"].map((v) => ({
  value: v,
  label: v,
}));

const MONTHS = [
  { value: "", label: "—" },
  ...["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(
    (m, i) => ({ value: String(i + 1), label: m }),
  ),
];

export function ExperienceManager({ experiences }: { experiences: Experience[] }) {
  const [editing, setEditing] = useState<Experience | null>(null);
  const [adding, setAdding] = useState(false);
  const [order, setOrder] = useState(experiences);
  const [isCurrent, setIsCurrent] = useState(false);
  const [state, action, pending] = useActionState(saveExperienceAction, initial);

  const move = (index: number, delta: number) => {
    const next = [...order];
    const t = index + delta;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t], next[index]];
    setOrder(next);
  };

  const startEdit = (e: Experience) => {
    setEditing(e);
    setAdding(false);
    setIsCurrent(e.isCurrent);
  };

  return (
    <div className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <Card
        title={`Entries (${order.length})`}
        actions={
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
              setIsCurrent(false);
            }}
            className="adm-btn adm-btn-primary"
          >
            Add entry
          </button>
        }
      >
        {order.length === 0 ? (
          <p className="text-[14px] text-muted">No entries yet.</p>
        ) : (
          <>
            <form action={reorderExperiencesAction}>
              <ul className="divide-y divide-line">
                {order.map((e, i) => (
                  <li key={e.id} className="flex items-start gap-3 py-3">
                    <input type="hidden" name="id" value={e.id} />
                    <MoveButtons
                      label={e.company}
                      onUp={() => move(i, -1)}
                      onDown={() => move(i, 1)}
                      disabledUp={i === 0}
                      disabledDown={i === order.length - 1}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-3 text-[14px] font-semibold uppercase tracking-wide text-ink">
                        {e.company}
                        <span className="text-[13px] font-normal normal-case tabular-nums text-muted">
                          {formatDateRange(e)}
                        </span>
                        {!e.isVisible ? <span className="text-[12px] font-normal normal-case text-muted">hidden</span> : null}
                      </p>
                      <p className="text-[13px] text-muted">
                        {[e.role, e.workType].filter(Boolean).join(" – ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      className="adm-link shrink-0 text-[13px]"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Submit variant="outline">Save order</Submit>
              </div>
            </form>
            <form action={reorderExperiencesAction} className="mt-2">
              <input type="hidden" name="mode" value="auto" />
              <button
                type="submit"
                className="adm-link text-[13px]"
              >
                Sort automatically by date (newest first)
              </button>
            </form>
          </>
        )}
      </Card>

      {adding || editing ? (
        <Card title={editing ? `Edit “${editing.company}”` : "Add an entry"}>
          <form action={action} className="space-y-4" key={editing?.id ?? "new"}>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <Field label="Company" name="company" defaultValue={editing?.company ?? ""} max={80} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role" name="role" defaultValue={editing?.role ?? ""} max={80} />
              <Select
                label="Work type"
                name="workType"
                defaultValue={editing?.workType ?? "Remote"}
                options={WORK_TYPES}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-2">
                <Select label="Start month" name="startMonth" defaultValue={String(editing?.startMonth ?? "")} options={MONTHS} />
                <NumberField label="Start year" name="startYear" min={1950} max={2100} defaultValue={editing?.startYear ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="End month"
                  name="endMonth"
                  defaultValue={String(editing?.endMonth ?? "")}
                  options={MONTHS}
                  disabled={isCurrent}
                />
                <NumberField label="End year" name="endYear" min={1950} max={2100} defaultValue={editing?.endYear ?? ""} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[14px] text-ink">
              <input type="hidden" name="isCurrent" value="0" />
              <input
                type="checkbox"
                name="isCurrent"
                value="1"
                checked={isCurrent}
                onChange={(e) => setIsCurrent(e.target.checked)}
                className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
              />
              This is my current role (shows “Present”)
            </label>

            <Field
              label="Description"
              name="description"
              multiline
              rows={3}
              defaultValue={editing?.description ?? ""}
              rec={LIMITS.experienceDescription.rec}
              max={LIMITS.experienceDescription.max}
              hint="One or two sentences on what you achieved."
            />
            <Toggle label="Show on the site" name="isVisible" defaultChecked={editing?.isVisible ?? true} />

            <div className="flex flex-wrap gap-2">
              <Submit pending={pending}>{editing ? "Update entry" : "Add entry"}</Submit>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setAdding(false);
                }}
                className="adm-btn adm-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
          {editing ? (
            <form action={deleteExperienceAction} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="id" value={editing.id} />
              <button type="submit" className="text-[13px] font-medium text-ember underline decoration-2 underline-offset-2 hover:opacity-80">
                Delete this entry
              </button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
