import React from "react";

/**
 * A deliberately small Markdown subset, rendered to React elements rather than
 * HTML strings — so nothing can inject markup and there is no dangerouslySet-
 * InnerHTML anywhere on the site.
 *
 * Bio (PRD §7.4):   **bold**, *italic*, [link](url)
 * Story (PROJ-04):  the above + ### headings, lists, > quotes, paragraphs
 */

type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "link"; value: string; href: string };

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)\s]+\))/g;

/** Only http(s) and mailto survive; everything else is rendered as plain text. */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  return null;
}

function tokenizeInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of input.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ type: "text", value: input.slice(last, index) });
    const raw = match[0];
    if (raw.startsWith("**")) tokens.push({ type: "bold", value: raw.slice(2, -2) });
    else if (raw.startsWith("[")) {
      const m = raw.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (m) tokens.push({ type: "link", value: m[1], href: m[2] });
      else tokens.push({ type: "text", value: raw });
    } else tokens.push({ type: "italic", value: raw.slice(1, -1) });
    last = index + raw.length;
  }
  if (last < input.length) tokens.push({ type: "text", value: input.slice(last) });
  return tokens;
}

export function renderInline(input: string, keyPrefix = "i"): React.ReactNode[] {
  return tokenizeInline(input).map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (token.type) {
      case "bold":
        return <strong key={key}>{token.value}</strong>;
      case "italic":
        return <em key={key}>{token.value}</em>;
      case "link": {
        const href = safeHref(token.href);
        if (!href) return <span key={key}>{token.value}</span>;
        const external = /^https?:/i.test(href);
        return (
          <a
            key={key}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {token.value}
          </a>
        );
      }
      default:
        return <React.Fragment key={key}>{token.value}</React.Fragment>;
    }
  });
}

/** Inline-only rendering — used for the bio (bold / italic / link). */
export function RichInline({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  if (paragraphs.length === 0) return null;
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i}>{renderInline(p, `p${i}`)}</p>
      ))}
    </div>
  );
}

type Block =
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }
    if (/^#{2,4}\s+/.test(trimmed)) {
      flush();
      blocks.push({ type: "h3", text: trimmed.replace(/^#{2,4}\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("> ")) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quote.push(lines[i].trim().slice(2));
        i++;
      }
      i--;
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i++;
      }
      i--;
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      i--;
      blocks.push({ type: "ol", items });
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

/** Full story rendering — PROJ-04. */
export function RichText({ text, className }: { text: string | null; className?: string }) {
  if (!text?.trim()) return null;
  const blocks = parseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h3":
            return <h3 key={i}>{renderInline(block.text, `h${i}`)}</h3>;
          case "quote":
            return <blockquote key={i}>{renderInline(block.text, `q${i}`)}</blockquote>;
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `u${i}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `o${i}-${j}`)}</li>
                ))}
              </ol>
            );
          default:
            return <p key={i}>{renderInline(block.text, `p${i}`)}</p>;
        }
      })}
    </div>
  );
}

/** Plain-text projection — used for meta descriptions and previews. */
export function toPlainText(markdown: string | null | undefined, max = 300): string {
  if (!markdown) return "";
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
