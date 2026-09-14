"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import {
  saveToolAction, deleteToolAction, reorderToolsAction, type ActionState,
} from "@/app/admin/actions";
import { Field, Toggle, Submit, Card, FormError, FormSuccess, MoveButtons } from "@/components/admin/form";
import { MediaField } from "@/components/media/MediaField";
import type { Tool } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

export function ToolsManager({ tools }: { tools: Tool[] }) {
  const [editing, setEditing] = useState<Tool | null>(null);
  const [adding, setAdding] = useState(false);
  const [order, setOrder] = useState(tools);
  const [state, action, pending] = useActionState(saveToolAction, initial);

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

      <Card
        title={`Your tools (${order.length})`}
        actions={
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
            }}
            className="adm-btn adm-btn-primary"
          >
            Add tool
          </button>
        }
      >
        {order.length === 0 ? (
          <p className="text-[14px] text-muted">No tools yet.</p>
        ) : (
          <form action={reorderToolsAction}>
            <ul className="divide-y divide-line">
              {order.map((tool, i) => (
                <li key={tool.id} className="flex items-center gap-3 py-2">
                  <input type="hidden" name="id" value={tool.id} />
                  <MoveButtons
                    label={tool.name}
                    onUp={() => move(i, -1)}
                    onDown={() => move(i, 1)}
                    disabledUp={i === 0}
                    disabledDown={i === order.length - 1}
                  />
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-surface">
                    {tool.icon?.storagePath || tool.icon?.originalUrl ? (
                      <Image
                        src={tool.icon.storagePath ?? tool.icon.originalUrl!}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="size-8 object-contain"
                      />
                    ) : (
                      <span className="text-[11px] font-semibold text-muted">?</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {tool.name}
                    {!tool.isVisible ? <span className="ml-2 text-[12px] text-muted">hidden</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(tool);
                      setAdding(false);
                    }}
                    className="adm-link shrink-0 text-[13px]"
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Submit variant="outline">Save order</Submit>
            </div>
          </form>
        )}
      </Card>

      {adding || editing ? (
        <Card title={editing ? `Edit “${editing.name}”` : "Add a tool"}>
          <form action={action} className="space-y-4" key={editing?.id ?? "new"}>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <Field label="Name" name="name" defaultValue={editing?.name ?? ""} max={48} required />
            <MediaField
              name="iconMediaId"
              label="Icon"
              hint="Square PNG, SVG or WebP."
              initial={editing?.icon ?? null}
              allow={{ upload: true, url: true }}
            />
            <Field
              label="Link"
              name="url"
              type="url"
              defaultValue={editing?.url ?? ""}
              hint="Optional."
            />
            <Toggle label="Show on the site" name="isVisible" defaultChecked={editing?.isVisible ?? true} />
            <div className="flex flex-wrap gap-2">
              <Submit pending={pending}>{editing ? "Update tool" : "Add tool"}</Submit>
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
            <form action={deleteToolAction} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="id" value={editing.id} />
              <button
                type="submit"
                className="text-[13px] font-medium text-ember underline decoration-2 underline-offset-2 hover:opacity-80"
              >
                Delete “{editing.name}”
              </button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
