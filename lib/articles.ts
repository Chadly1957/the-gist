import * as cheerio from "cheerio";

// Helpers for the original-article CMS (Story model, /articles). Kept
// framework-free so the admin API, the public pages, and the RSS feed all
// share one slug/excerpt/sanitize implementation.

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Summary used for article cards, og:description, and the RSS <description>
// (which is what the Source tab's pool shows). Derived from the body's
// opening text when the author did not write one.
export function deriveExcerpt(bodyHtml: string, maxLength = 200): string {
  const text = stripHtml(bodyHtml);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
  "a", "ul", "ol", "li", "blockquote", "img", "figure", "figcaption",
  "code", "pre", "span",
]);
const DROP_WITH_CONTENT = new Set([
  "script", "style", "iframe", "object", "embed", "form", "input",
  "button", "textarea", "select", "link", "meta", "title", "noscript",
]);

function safeUrl(value: string): string | null {
  const v = value.trim();
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

// Allowlist sanitizer for editor HTML. Bodies are authored by the admin,
// but article pages are public and render the HTML raw, so anything that
// reaches the database is reduced to formatting tags with safe link/image
// attributes only (no event handlers, no javascript: URLs, no embeds).
export function sanitizeArticleHtml(html: string): string {
  const $ = cheerio.load(html, null, false);

  // Remove dangerous elements together with their contents.
  DROP_WITH_CONTENT.forEach((tag) => $(tag).remove());

  // Unwrap anything not on the allowlist, keeping its (sanitized) children.
  $("*").each((_, el) => {
    const node = el as unknown as { tagName?: string; type?: string };
    if (node.type !== "tag" || !node.tagName) return;
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      $(el).replaceWith($(el).contents());
    }
  });

  // Scrub attributes on the survivors.
  $("*").each((_, el) => {
    const node = el as unknown as { tagName?: string; type?: string; attribs?: Record<string, string> };
    if (node.type !== "tag" || !node.tagName) return;
    const tag = node.tagName.toLowerCase();
    const attribs = node.attribs || {};
    for (const name of Object.keys(attribs)) {
      const lower = name.toLowerCase();
      let keep = false;
      if (tag === "a" && lower === "href" && safeUrl(attribs[name])) keep = true;
      if (tag === "img" && (lower === "src" || lower === "alt") && (lower === "alt" || safeUrl(attribs[name]))) keep = true;
      if (!keep) $(el).removeAttr(name);
    }
    if (tag === "a") {
      $(el).attr("rel", "noopener noreferrer");
    }
  });

  return $.html().trim();
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}
