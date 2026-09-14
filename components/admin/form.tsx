"use client";

import { useEffect, useId, useRef, useState } from "react";

/* ============================================================================
   Dashboard form primitives.

   Two rules do most of the work:
   1. The hint sits under the label, never beside it — so a long hint and the
      character counter can't collide on a narrow screen.
   2. Inputs are sized by what goes in them. A four-digit year does not get a
      60-character box.
   ========================================================================== */

export type FieldWidth = "xs" | "sm" | "md" | "full";

const widthClass = (w: FieldWidth = "full") =>
  w === "full" ? "" : `adm-w-${w}`;

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="adm-label">
      {children}
      {required ? <span className="ml-0.5 text-signal">*</span> : null}
    </label>
  );
}

/** PRD §9.5 — soft warning at Recommended, hard stop at Max. */
export function CharCount({ value, rec, max }: { value: string; rec?: number; max: number }) {
  const n = value.length;
  const over = rec !== undefined && n > rec;
  return (
    <span
      className={`shrink-0 text-[12px] tabular-nums ${over ? "text-ember" : "text-muted"}`}
      title={over ? `Longer than the recommended ${rec} characters` : undefined}
    >
      {n}/{max}
    </span>
  );
}

export function Field({
  label,
  name,
  hint,
  error,
  rec,
  max,
  width = "full",
  defaultValue = "",
  type = "text",
  multiline,
  rows = 4,
  required,
  className = "",
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string | null;
  rec?: number;
  max?: number;
  width?: FieldWidth;
  defaultValue?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "type" | "width">) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const overRec = rec !== undefined && value.length > rec;

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        {max ? <CharCount value={value} rec={rec} max={max} /> : null}
      </div>
      {hint ? <span className="adm-hint">{hint}</span> : null}

      <div className={`mt-2 ${multiline ? "" : widthClass(width)}`}>
        {multiline ? (
          <textarea
            id={id}
            name={name}
            rows={rows}
            maxLength={max}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="adm-input resize-y"
            {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={id}
            name={name}
            type={type}
            maxLength={max}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="adm-input"
            {...rest}
          />
        )}
      </div>

      {overRec && !error ? (
        <p className="mt-1.5 text-[12.5px] text-ember">
          Longer than the recommended {rec} characters — still fine, just tighter on the page.
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-[12.5px] text-ember">{error}</p> : null}
    </div>
  );
}

/** Numeric input — kept separate so `max` stays the character counter on Field. */
export function NumberField({
  label,
  name,
  hint,
  defaultValue,
  min,
  max,
  step,
  width = "xs",
  className = "",
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
  width?: FieldWidth;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {hint ? <span className="adm-hint">{hint}</span> : null}
      <div className={`mt-2 ${widthClass(width)}`}>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="numeric"
          defaultValue={defaultValue}
          min={min}
          max={max}
          step={step}
          className="adm-input"
        />
      </div>
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  hint,
  width = "md",
  className = "",
  ...rest
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  width?: FieldWidth;
  className?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "width">) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {hint ? <span className="adm-hint">{hint}</span> : null}
      <div className={`mt-2 ${widthClass(width)}`}>
        <select id={id} name={name} defaultValue={defaultValue} className="adm-input" {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function Toggle({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      {/* An unchecked checkbox submits nothing, so pair it with a hidden "0". */}
      <input type="hidden" name={name} value="0" />
      <input
        id={id}
        name={name}
        type="checkbox"
        value="1"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] leading-snug text-ink">
          {label}
        </label>
        {hint ? <p className="adm-hint">{hint}</p> : null}
      </div>
    </div>
  );
}

export function Submit({
  pending,
  children,
  className = "",
  variant = "primary",
  name,
  value,
}: {
  pending?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "outline";
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`adm-btn ${variant === "primary" ? "adm-btn-primary" : "adm-btn-secondary"} ${className}`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-admin)] border border-ember/35 bg-ember/[0.06] px-3.5 py-2.5 text-[13.5px] leading-snug text-ember"
    >
      <span aria-hidden="true" className="mt-[3px] size-1.5 shrink-0 rounded-full bg-ember" />
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-[var(--radius-admin)] border border-signal/40 bg-signal/[0.07] px-3.5 py-2.5 text-[13.5px] leading-snug text-ink"
    >
      <span aria-hidden="true" className="mt-[3px] size-1.5 shrink-0 rounded-full bg-signal" />
      {message}
    </p>
  );
}

/** PRD §9.2 — unsaved-changes warning, plus Ctrl/⌘ S to save. */
export function FormGuards({ formId }: { formId?: string }) {
  const dirty = useRef(false);

  useEffect(() => {
    const form = formId
      ? (document.getElementById(formId) as HTMLFormElement | null)
      : (document.querySelector("form[data-guard]") as HTMLFormElement | null);
    if (!form) return;

    const markDirty = () => {
      dirty.current = true;
    };
    const clearDirty = () => {
      dirty.current = false;
    };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", clearDirty);

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        form.requestSubmit();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("keydown", onKey);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", clearDirty);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("keydown", onKey);
    };
  }, [formId]);

  return null;
}

export function Card({
  title,
  description,
  children,
  actions,
  id,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="adm-card">
      {title ? (
        <header className="adm-card-head">
          <div className="min-w-0">
            <h2 className="adm-title">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="adm-card-body">{children}</div>
    </section>
  );
}

/** A row of fields that sits side by side once there's room for it. */
export function FieldRow({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div className={`grid gap-5 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {children}
    </div>
  );
}

/** Reorder control that works by touch and keyboard (PRD §9.2). */
export function MoveButtons({
  onUp,
  onDown,
  disabledUp,
  disabledDown,
  label,
}: {
  onUp: () => void;
  onDown: () => void;
  disabledUp?: boolean;
  disabledDown?: boolean;
  label: string;
}) {
  return (
    <span className="flex shrink-0 flex-col text-muted">
      <button
        type="button"
        onClick={onUp}
        disabled={disabledUp}
        aria-label={`Move ${label} up`}
        className="grid size-6 place-items-center rounded hover:bg-surface hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
          <path d="M8 12.5v-9M4 7l4-4 4 4" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disabledDown}
        aria-label={`Move ${label} down`}
        className="grid size-6 place-items-center rounded hover:bg-surface hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
          <path d="M8 3.5v9M4 9l4 4 4-4" />
        </svg>
      </button>
    </span>
  );
}

/** Status pill used across the projects list and editor. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="adm-badge capitalize" data-tone={status === "published" ? "live" : undefined}>
      {status === "published" ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
      ) : null}
      {status}
    </span>
  );
}

/** An empty state should invite an action, not just report emptiness. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-admin)] border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children ? (
        <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
          {children}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
