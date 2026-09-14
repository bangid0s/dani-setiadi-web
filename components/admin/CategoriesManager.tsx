"use client";

import { useActionState, useState } from "react";
import {
  saveCategoryAction, deleteCategoryAction, reorderCategoriesAction, type ActionState,
} from "@/app/admin/actions";
import { Field, Toggle, Submit, Card, FormError, FormSuccess, MoveButtons } from "@/components/admin/form";
import type { Category } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

export function CategoriesManager({
  categories,
  counts,
}: {
  categories: Category[];
  counts: Record<string, number>;
}) {
  const [order, setOrder] = useState(categories);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [state, action, pending] = useActionState(saveCategoryAction, initial);

  const move = (index: number, delta: number) => {
    const next = [...order];
    const t = index + delta;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t], next[index]];
    setOrder(next);
  };

  return (
    <div className="space-y-6">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <Card title={`Categories (${order.length})`}>
        <form action={reorderCategoriesAction}>
          <ul className="divide-y divide-line">
            {order.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <input type="hidden" name="id" value={c.id} />
                <MoveButtons
                  label={c.name}
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  disabledUp={i === 0}
                  disabledDown={i === order.length - 1}
                />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                  {c.name}
                  <span className="ml-2 text-[12px] text-muted">
                    {counts[c.id] ?? 0} {counts[c.id] === 1 ? "project" : "projects"}
                    {!c.isVisible ? " · hidden" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="adm-link shrink-0 text-[13px]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(c)}
                  className="shrink-0 text-[13px] font-medium text-ember underline decoration-2 underline-offset-2 hover:opacity-80"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {order.length > 0 ? (
            <div className="mt-4">
              <Submit variant="outline">Save order</Submit>
            </div>
          ) : null}
        </form>
      </Card>

      <Card title={editing ? `Rename “${editing.name}”` : "Add a category"}>
        <form action={action} className="space-y-4" key={editing?.id ?? "new"}>
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Field label="Name" name="name" defaultValue={editing?.name ?? ""} max={48} required />
          <Toggle label="Show as a filter" name="isVisible" defaultChecked={editing?.isVisible ?? true} />
          <div className="flex gap-2">
            <Submit pending={pending}>{editing ? "Update" : "Add category"}</Submit>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="adm-btn adm-btn-secondary"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      {deleting ? (
        <Card title={`Delete “${deleting.name}”?`}>
          <form action={deleteCategoryAction} className="space-y-4">
            <input type="hidden" name="id" value={deleting.id} />
            <p className="text-[14px] text-ink">
              {counts[deleting.id] ? (
                <>
                  {counts[deleting.id]} {counts[deleting.id] === 1 ? "project uses" : "projects use"}{" "}
                  this category. Choose where they should go.
                </>
              ) : (
                "Nothing uses this category."
              )}
            </p>
            {counts[deleting.id] ? (
              <label className="block">
                <span className="text-[13px] font-semibold text-ink">Move those projects to</span>
                <select
                  name="moveTo"
                  className="adm-input mt-2"
                >
                  <option value="">Leave them without this category</option>
                  {order
                    .filter((c) => c.id !== deleting.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                className="adm-btn adm-btn-primary !bg-ember !text-cream"
              >
                Delete category
              </button>
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="adm-btn adm-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
