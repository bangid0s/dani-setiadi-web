"use client";

import { useState } from "react";
import { saveSectionsOrderAction } from "@/app/admin/actions";
import { Submit, MoveButtons } from "@/components/admin/form";
import { pad2 } from "@/lib/format";
import type { Section } from "@/lib/types";

const LOCKED = new Set(["hero"]); // the hero always leads the page

export function SectionsManager({ sections }: { sections: Section[] }) {
  const [order, setOrder] = useState(sections);

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  let visibleIndex = 0;

  return (
    <form action={saveSectionsOrderAction} className="space-y-4">
      <ul className="space-y-2">
        {order.map((section, i) => {
          const number = section.isVisible ? ++visibleIndex : null;
          return (
            <li
              key={section.key}
              className="flex items-center gap-3 rounded-[var(--radius-admin)] border border-line bg-white p-3"
            >
              <input type="hidden" name="key" value={section.key} />
              <MoveButtons
                label={section.label}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                disabledUp={i === 0}
                disabledDown={i === order.length - 1}
              />
              <span className="w-10 shrink-0 text-[13px] tabular-nums text-muted">
                {number ? `${pad2(number)}/` : "—"}
              </span>
              <input
                name={`label-${section.key}`}
                defaultValue={section.label}
                maxLength={32}
                className="adm-input min-w-0 flex-1"
                aria-label={`Label for the ${section.key} chapter`}
              />
              <label className="flex shrink-0 items-center gap-2 text-[13px] text-ink">
                <input type="hidden" name={`visible-${section.key}`} value="0" />
                <input
                  type="checkbox"
                  name={`visible-${section.key}`}
                  value="1"
                  defaultChecked={section.isVisible}
                  disabled={LOCKED.has(section.key)}
                  className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
                />
                Visible
              </label>
            </li>
          );
        })}
      </ul>
      <Submit>Save order</Submit>
    </form>
  );
}
