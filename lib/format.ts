/** Shared formatting helpers — kept in one place so the site reads consistently. */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * PRD §7.4 — dates use an en dash; current roles read "2023–Present".
 */
export function formatDateRange(e: {
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
}): string {
  const part = (year: number | null, month: number | null) => {
    if (!year) return "";
    return month ? `${MONTHS[month - 1]} ${year}` : String(year);
  };
  const start = part(e.startYear, e.startMonth);
  const end = e.isCurrent ? "Present" : part(e.endYear, e.endMonth);
  if (start && end) return `${start}–${end}`;
  return start || end;
}

/** "01/", "02/" … used by IndexLabel and the lightbox counter. */
export const pad2 = (n: number) => String(n).padStart(2, "0");

export function whatsappUrl(e164: string, message: string): string | null {
  const digits = e164.replace(/[^\d]/g, "");
  if (!digits) return null;
  const text = message.trim() ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function mailtoUrl(email: string, subject?: string): string | null {
  if (!email.trim()) return null;
  return `mailto:${email.trim()}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

export const bytesToSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
