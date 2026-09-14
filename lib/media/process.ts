import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

// PRD §8.3 — upload rules.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_LONG_EDGE = 3200;

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
export const FILES_DIR = path.join(process.cwd(), "public", "files");

export type DetectedType =
  | "image/jpeg" | "image/png" | "image/webp" | "image/avif"
  | "image/gif" | "image/svg+xml" | "application/pdf" | null;

/** Validate by file signature, not just by extension (PRD §8.3). */
export function detectType(buf: Buffer): DetectedType {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.subarray(0, 3).toString("latin1") === "GIF") return "image/gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP")
    return "image/webp";
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (brand.startsWith("avif") || brand.startsWith("avis") || brand === "mif1")
      return "image/avif";
  }
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";

  // SVG is text: look past a BOM / whitespace / XML prolog / comments for "<svg".
  const head = buf.subarray(0, 2048).toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (/^<(\?xml|!DOCTYPE svg|svg|!--)/i.test(head) && /<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}

export const ACCEPTED_IMAGE_TYPES: DetectedType[] = [
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml",
];

export const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/**
 * Strip scripts, event handlers and external references from an SVG before it
 * is ever stored (PRD §12 security; test matrix row "SVG containing <script>").
 */
export function sanitizeSvg(input: string): string {
  let svg = input;
  // Remove whole dangerous elements including their content.
  svg = svg.replace(
    /<\s*(script|foreignObject|iframe|object|embed|audio|video|animate|set|handler)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  // ...and their self-closing forms.
  svg = svg.replace(
    /<\s*(script|foreignObject|iframe|object|embed|audio|video|animate|set|handler)\b[^>]*\/\s*>/gi,
    "",
  );
  // Entity definitions (billion-laughs / XXE vectors).
  svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!ENTITY[\s\S]*?>/gi, "");
  // on* event handlers, in quoted and unquoted forms.
  svg = svg.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  // javascript: / data: in href-like attributes.
  svg = svg.replace(
    /\s(?:xlink:)?href\s*=\s*(["'])\s*(?:javascript|data|vbscript):[^"']*\1/gi,
    "",
  );
  // External loads (remote images, CSS imports).
  svg = svg.replace(/@import\s+[^;]+;/gi, "");
  return svg.trim();
}

export type ProcessedImage = {
  buffer: Buffer;
  mime: string;
  width: number;
  height: number;
  lqip: string | null;
  dominantColor: string | null;
};

/**
 * Reads dimensions, downscales oversized rasters and builds the blur
 * placeholder. GIF and SVG are stored as-is (PRD §8.3).
 */
export async function processImage(
  buf: Buffer,
  mime: string,
  opts: { keepOriginal?: boolean } = {},
): Promise<ProcessedImage> {
  if (mime === "image/svg+xml") {
    const clean = Buffer.from(sanitizeSvg(buf.toString("utf8")), "utf8");
    const { width, height } = readSvgSize(clean.toString("utf8"));
    return { buffer: clean, mime, width, height, lqip: null, dominantColor: null };
  }

  if (mime === "image/gif") {
    const meta = await sharp(buf, { animated: true }).metadata();
    return {
      buffer: buf,
      mime,
      width: meta.width ?? 1,
      // An animated GIF's reported height covers every frame stacked vertically.
      height: meta.pageHeight ?? meta.height ?? 1,
      lqip: await makeLqip(buf).catch(() => null),
      dominantColor: await makeDominant(buf).catch(() => null),
    };
  }

  let pipeline = sharp(buf, { failOn: "none" }).rotate(); // honour EXIF orientation
  let meta = await pipeline.metadata();
  let out = buf;
  let width = meta.width ?? 1;
  let height = meta.height ?? 1;

  const longEdge = Math.max(width, height);
  if (!opts.keepOriginal && longEdge > MAX_LONG_EDGE) {
    pipeline = pipeline.resize({
      width: width >= height ? MAX_LONG_EDGE : undefined,
      height: height > width ? MAX_LONG_EDGE : undefined,
      withoutEnlargement: true,
    });
    const resized = await pipeline.toBuffer({ resolveWithObject: true });
    out = resized.data;
    width = resized.info.width;
    height = resized.info.height;
  } else if (meta.orientation && meta.orientation > 1) {
    // Bake in the EXIF rotation so width/height match what browsers render.
    const rotated = await sharp(buf).rotate().toBuffer({ resolveWithObject: true });
    out = rotated.data;
    width = rotated.info.width;
    height = rotated.info.height;
    meta = await sharp(out).metadata();
  }

  return {
    buffer: out,
    mime,
    width,
    height,
    lqip: await makeLqip(out).catch(() => null),
    dominantColor: await makeDominant(out).catch(() => null),
  };
}

/** Tiny blurred preview as a data URI, for next/image `placeholder="blur"`. */
export async function makeLqip(buf: Buffer): Promise<string> {
  const tiny = await sharp(buf, { failOn: "none", animated: false })
    .resize(16, 16, { fit: "inside" })
    .webp({ quality: 45 })
    .toBuffer();
  return `data:image/webp;base64,${tiny.toString("base64")}`;
}

export async function makeDominant(buf: Buffer): Promise<string> {
  const { dominant } = await sharp(buf, { failOn: "none", animated: false }).stats();
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`;
}

/** Best-effort intrinsic size for an SVG (width/height, else viewBox). */
function readSvgSize(svg: string): { width: number; height: number } {
  const open = svg.match(/<svg[^>]*>/i)?.[0] ?? "";
  const num = (attr: string) => {
    const m = open.match(new RegExp(`${attr}\\s*=\\s*["']([\\d.]+)`, "i"));
    return m ? Number(m[1]) : null;
  };
  const w = num("width");
  const h = num("height");
  if (w && h) return { width: Math.round(w), height: Math.round(h) };
  const vb = open.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
  if (vb) return { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
  return { width: 512, height: 512 };
}

/** Writes bytes under public/uploads and returns the public path. */
export async function storeFile(
  buffer: Buffer,
  mime: string,
  dir: string = UPLOAD_DIR,
): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const ext = EXTENSION[mime] ?? "bin";
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, name), buffer);
  const publicDir = dir === FILES_DIR ? "files" : "uploads";
  return `/${publicDir}/${name}`;
}

export async function deleteStoredFile(publicPath: string | null): Promise<void> {
  if (!publicPath?.startsWith("/uploads/") && !publicPath?.startsWith("/files/")) return;
  const abs = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  // Guard against traversal in a stored path.
  const root = path.join(process.cwd(), "public");
  if (!abs.startsWith(root + path.sep)) return;
  await fs.unlink(abs).catch(() => {});
}
