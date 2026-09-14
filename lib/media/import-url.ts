import dns from "node:dns/promises";
import net from "node:net";

// PRD §8.4 — Image URL rules: fetch server-side, SSRF-guarded, smart handling.

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024; // 20 MB
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set([80, 443]);

export class ImportError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export function googleDriveFileId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") return null;
    const fromPath = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
    return fromPath?.[1] ?? url.searchParams.get("id");
  } catch {
    return null;
  }
}

export function normalizeDropboxUrl(url: URL): URL {
  if (url.hostname === "dropbox.com" || url.hostname.endsWith(".dropbox.com")) {
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
  }
  return url;
}

/** Blocks private, loopback, link-local and unique-local addresses (PRD §8.4). */
export function isBlockedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(address)) {
    const v6 = address.toLowerCase().replace(/^\[|\]$/g, "");
    if (v6 === "::" || v6 === "::1") return true;
    if (v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
    if (v6.startsWith("ff")) return true; // multicast
    // IPv4-mapped (::ffff:127.0.0.1) — re-check the embedded v4 address.
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return false;
  }
  return true;
}

/** Resolves the host and rejects anything that points at a private address. */
async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportError("Only http and https links are supported.");
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new ImportError("That link uses a non-standard port, which isn’t allowed.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new ImportError("That address is on a private network and can’t be fetched.");
    }
    return;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new ImportError("That address is on a private network and can’t be fetched.");
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new ImportError("That address couldn’t be found. Check the link and try again.");
  }
  if (records.length === 0 || records.some((r) => isBlockedAddress(r.address))) {
    throw new ImportError("That address is on a private network and can’t be fetched.");
  }
}

export type FetchedImage = {
  bytes: Buffer;
  contentType: string;
  finalUrl: string;
};

/**
 * Fetches a remote image with the §8.4 limits: 10 s timeout, ≤ 20 MB, ≤ 3
 * redirects, every hop re-checked against the SSRF guard, and the response must
 * be `image/*`. An HTML response means the link is a web page, not an image.
 */
export async function fetchRemoteImage(rawUrl: string): Promise<FetchedImage> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ImportError("That doesn’t look like a valid link.");
  }

  const driveId = googleDriveFileId(url.toString());
  if (driveId) {
    url = new URL(`https://drive.google.com/uc?export=download&id=${driveId}`);
  } else {
    url = normalizeDropboxUrl(url);
  }

  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current);

    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some CDNs 403 a bare fetch; a UA and accept header is the polite fix.
        "user-agent": "Mozilla/5.0 (compatible; DaniSetiadiPortfolio/1.0)",
        accept: "image/*,*/*;q=0.8",
      },
    }).catch((err: unknown) => {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new ImportError("That link took too long to respond. Try again, or upload the file.");
      }
      throw new ImportError("That link couldn’t be reached. Check it and try again.");
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new ImportError("That link redirects somewhere we can’t follow.");
      current = new URL(location, current);
      continue;
    }

    if (res.status === 403 && driveId) {
      throw new ImportError(
        "This Google Drive file isn’t shared publicly.",
        "Open the file in Drive → Share → General access → “Anyone with the link”, then paste it again.",
      );
    }
    if (!res.ok) {
      throw new ImportError(`That link returned an error (${res.status}). Check it and try again.`);
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

    if (contentType.startsWith("text/html")) {
      if (driveId) {
        throw new ImportError(
          "This Google Drive file isn’t shared publicly.",
          "Open the file in Drive → Share → General access → “Anyone with the link”, then paste it again.",
        );
      }
      throw new ImportError(
        "This link opens a web page, not an image.",
        "Open the image itself, right-click it and choose “Copy image address” — or download it and use Upload.",
      );
    }
    if (!contentType.startsWith("image/")) {
      throw new ImportError(
        `That link returns ${contentType || "an unknown file type"}, not an image.`,
        "Paste a direct image address (it usually ends in .jpg, .png or .webp), or use Upload.",
      );
    }

    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_IMPORT_BYTES) {
      throw new ImportError("That image is larger than 20 MB.");
    }

    const buffer = await readCapped(res, MAX_IMPORT_BYTES);
    return { bytes: buffer, contentType, finalUrl: current.toString() };
  }

  throw new ImportError("That link redirects too many times.");
}

/** Streams the body, aborting as soon as it exceeds the cap. */
async function readCapped(res: Response, cap: number): Promise<Buffer> {
  if (!res.body) throw new ImportError("That link returned an empty response.");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      throw new ImportError("That image is larger than 20 MB.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
