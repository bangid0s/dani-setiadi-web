import { randomUUID, randomBytes } from "node:crypto";

export const newId = (): string => randomUUID();
export const newToken = (): string => randomBytes(32).toString("base64url");

/** URL-safe slug. Falls back to a short random suffix when the input is empty. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || `item-${randomBytes(3).toString("hex")}`;
}
