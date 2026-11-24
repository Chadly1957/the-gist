import { escapeHtml } from "@/lib/html";

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// A URL is safe to link when it is an absolute http(s) URL or a
// same-site path. Anything else (javascript:, data:, protocol-relative)
// is left as plain text.
function safeLinkUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return null;
}

// Split sentence punctuation off the end of a bare URL: "See
// https://example.com." links the URL, not the period. A closing
// paren/bracket is only stripped when it is unbalanced (prose wrapping
// the link), so URLs with balanced parens keep them.
function splitTrailingPunct(url: string): [string, string] {
  let end = url.length;
  while (end > 0 && ".,;:!?".includes(url[end - 1])) end--;
  const closer = url[end - 1];
  if (closer === ")" || closer === "]") {
    const opener = closer === ")" ? "(" : "[";
    const opens = (url.slice(0, end).match(new RegExp(`\\${opener}`, "g")) || []).length;
    const closes = (url.slice(0, end).match(new RegExp(`\\${closer}`, "g")) || []).length;
    if (closes > opens) end--;
  }
  return [url.slice(0, end), url.slice(end)];
}

// Markdown links [text](url) or bare https:// URLs become links.
// Everything else is escaped, so raw HTML typed into the blurb can
// never inject tags into the newsletter; links are the only markup.
const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>"']+)/g;

function linkifySegment(segment: string): string {
  let out = "";
  let last = 0;
  LINK_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_PATTERN.exec(segment)) !== null) {
    out += escapeHtml(segment.slice(last, m.index));
    if (m[1] !== undefined) {
      // Markdown link [text](url).
      const href = safeLinkUrl(m[2]);
      if (href) {
        out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m[1])}</a>`;
      } else {
        out += escapeHtml(m[0]);
      }
    } else {
      // Bare URL.
      const [url, trailing] = splitTrailingPunct(m[3]);
      out += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(segment.slice(last));
  return out;
}

// Converts plain-text blurb (from a textarea) into safe HTML.
// Blank lines become paragraph breaks; single newlines become <br>.
// Links work two ways: paste a bare https:// link and it becomes
// clickable, or write [link text](https://example.com).
export function blurbToHtml(text: string): string {
  return text
    .trim()
    .split(/\n[ \t]*\n/)
    .filter(Boolean)
    .map((para) => `<p>${linkifySegment(para.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
