export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Converts plain-text blurb (from a textarea) into safe HTML.
// Blank lines become paragraph breaks; single newlines become <br>.
export function blurbToHtml(text: string): string {
  return text
    .trim()
    .split(/\n[ \t]*\n/)
    .filter(Boolean)
    .map((para) => `<p>${para.trim().replace(/\n/g, "<br>")}</p>`)
    .join("");
}
