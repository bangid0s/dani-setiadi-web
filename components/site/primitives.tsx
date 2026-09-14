import Link from "next/link";
import { pad2 } from "@/lib/format";

/** PRD §5.6 IndexLabel — "01/ Intro". The number is generated (GLB-02). */
export function IndexLabel({
  index,
  label,
  className = "",
}: {
  index: number;
  label: string;
  className?: string;
}) {
  return (
    <p className={`t-index text-muted ${className}`}>
      <span className="text-ink">{pad2(index)}/</span> {label}
    </p>
  );
}

/**
 * PRD §5.4 — a quiet lead line in Ink stacked tight over a loud keyword line in
 * Signal. One heading element for screen readers.
 */
export function TwoToneHeading({
  lead,
  keyword,
  as: Tag = "h2",
  id,
  className = "",
}: {
  lead: string;
  keyword: string;
  as?: "h1" | "h2";
  id?: string;
  className?: string;
}) {
  if (!lead && !keyword) return null;
  return (
    <Tag id={id} className={`text-balance ${className}`}>
      {lead ? <span className="block t-display-l text-ink">{lead}</span> : null}
      {keyword ? <span className="block t-display-xl text-signal">{keyword}</span> : null}
    </Tag>
  );
}

/** PRD §5.4 — Signal circle, aligned to the first text line. Decorative. */
export function DotBullet({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full bg-signal size-[14px] lg:size-[18px] ${className}`}
    />
  );
}

export function ButtonPrimary({
  href,
  children,
  external,
  className = "",
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a href={href} className={`btn-primary ${className}`} {...props} {...rest}>
      {children}
    </a>
  );
}

export function ButtonOutline({
  href,
  children,
  external,
  className = "",
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isInternal = href.startsWith("/") && !external;
  if (isInternal) {
    return (
      <Link href={href} className={`btn-outline ${className}`}>
        {children}
      </Link>
    );
  }
  const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a href={href} className={`btn-outline ${className}`} {...props} {...rest}>
      {children}
    </a>
  );
}

/** Lucide MapPin, inlined — the reference's location marker (PRD §5.8). */
export function MapPinIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5.14v13.72a.5.5 0 0 0 .77.42l10.5-6.86a.5.5 0 0 0 0-.84L8.77 4.72a.5.5 0 0 0-.77.42Z" />
    </svg>
  );
}

/** PRD §5.6 StatusPill — states open / limited / closed (§7.4). */
export function StatusPill({
  label,
  status,
  href,
  size = "lg",
}: {
  label: string;
  status: "open" | "limited" | "closed";
  href?: string;
  size?: "lg" | "sm";
}) {
  const closed = status === "closed";
  const base =
    size === "lg"
      ? "inline-flex items-center justify-center px-8 py-3 t-pill-xl"
      : "inline-flex items-center justify-center px-4 py-1.5 text-[14px] font-semibold uppercase tracking-[0.04em]";
  const tone = closed
    ? "border-line text-muted"
    : "border-signal text-signal hover:bg-signal hover:text-cream";
  const cls = `${base} rounded-full border-[length:var(--stroke-brand)] transition-colors duration-[180ms] ${tone}`;

  if (!href) return <span className={cls}>{label}</span>;
  const internal = href.startsWith("#") || href.startsWith("/");
  return internal ? (
    <Link href={href} className={cls}>
      {label}
    </Link>
  ) : (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
