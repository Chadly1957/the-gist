// Converts template block JSON into a full HTML email string

export interface Block {
  id: string;
  type: "header" | "text" | "image" | "articles" | "divider" | "footer" | "button";
  content: Record<string, unknown>;
}

export interface ArticleForRender {
  title: string;
  description: string;
  imageUrl: string | null;
  articleUrl: string;
  sourceName: string;
  publishedAt: Date | string;
}

const EMAIL_STYLES = `
  body { margin: 0; padding: 0; background: #f5f5f5; font-family: Georgia, serif; }
  .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
  .header { background: #166534; padding: 32px 40px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-family: Georgia, serif; letter-spacing: -0.5px; }
  .header .subtitle { color: #bbf7d0; margin: 6px 0 0; font-size: 14px; font-family: sans-serif; }
  .header .date { color: #86efac; margin: 4px 0 0; font-size: 12px; font-family: sans-serif; }
  .block { padding: 24px 40px; }
  .text-block p { color: #1f2937; font-size: 16px; line-height: 1.7; margin: 0 0 12px; }
  .section-label { font-family: sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #6b7280; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
  .article-card { display: block; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; text-decoration: none; }
  .article-img { width: 100%; height: 180px; object-fit: cover; display: block; }
  .article-img-placeholder { width: 100%; height: 120px; background: #f3f4f6; display: block; }
  .article-body { padding: 16px; }
  .article-source { font-family: sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 6px; }
  .article-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 8px; font-family: Georgia, serif; line-height: 1.3; }
  .article-desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 12px; font-family: sans-serif; }
  .read-more { display: inline-block; background: #166534; color: #ffffff !important; padding: 8px 18px; border-radius: 4px; text-decoration: none; font-size: 13px; font-family: sans-serif; font-weight: 600; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 8px 0; }
  .image-block img { max-width: 100%; height: auto; border-radius: 6px; display: block; }
  .button-block { text-align: center; padding: 24px 40px; }
  .cta-button { display: inline-block; background: #166534; color: #ffffff !important; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 16px; font-family: sans-serif; font-weight: 700; }
  .footer { background: #f9fafb; padding: 24px 40px; text-align: center; }
  .footer p { color: #9ca3af; font-size: 12px; font-family: sans-serif; margin: 4px 0; }
  .footer a { color: #6b7280; }
`;

function renderHeader(content: Record<string, unknown>): string {
  const date = String(content.date || "").replace(
    "{{DATE}}",
    new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })
  );
  return `
    <div class="header">
      <h1>${content.title || "The Gist Decatur"}</h1>
      ${content.subtitle ? `<p class="subtitle">${content.subtitle}</p>` : ""}
      ${date ? `<p class="date">${date}</p>` : ""}
    </div>`;
}

function renderText(content: Record<string, unknown>): string {
  return `<div class="block text-block">${content.html || ""}</div>`;
}

function renderImage(content: Record<string, unknown>): string {
  if (!content.url) return "";
  return `
    <div class="block image-block">
      <img src="${content.url}" alt="${content.alt || ""}" />
      ${content.caption ? `<p style="font-size:12px;color:#6b7280;margin-top:6px;font-family:sans-serif;">${content.caption}</p>` : ""}
    </div>`;
}

function renderArticles(
  content: Record<string, unknown>,
  articles: ArticleForRender[]
): string {
  if (articles.length === 0) return "";

  const cards = articles
    .map(
      (a) => `
      <a href="${a.articleUrl}" class="article-card" style="display:block;margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;text-decoration:none;">
        ${a.imageUrl ? `<img src="${a.imageUrl}" alt="" class="article-img" style="width:100%;height:180px;object-fit:cover;display:block;" />` : `<div class="article-img-placeholder"></div>`}
        <div class="article-body" style="padding:16px;">
          <div class="article-source" style="font-family:sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:6px;">${a.sourceName}</div>
          <div class="article-title" style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px;font-family:Georgia,serif;line-height:1.3;">${a.title}</div>
          <div class="article-desc" style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 12px;font-family:sans-serif;">${a.description}</div>
          <a href="${a.articleUrl}" class="read-more" style="display:inline-block;background:#166534;color:#ffffff;padding:8px 18px;border-radius:4px;text-decoration:none;font-size:13px;font-family:sans-serif;font-weight:600;">Read More</a>
        </div>
      </a>`
    )
    .join("");

  return `
    <div class="block">
      ${content.label ? `<div class="section-label">${content.label}</div>` : ""}
      ${cards}
    </div>`;
}

function renderDivider(): string {
  return `<div class="block" style="padding:8px 40px;"><hr class="divider" style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></div>`;
}

function renderButton(content: Record<string, unknown>): string {
  if (!content.url) return "";
  return `
    <div class="button-block">
      <a href="${content.url}" class="cta-button">${content.label || "Read More"}</a>
    </div>`;
}

function renderFooter(content: Record<string, unknown>): string {
  return `
    <div class="footer">
      <p>${content.text || "You are receiving this because you subscribed to The Gist Decatur."}</p>
      <p><a href="{{UNSUBSCRIBE_URL}}">${content.unsubscribeText || "Unsubscribe"}</a></p>
    </div>`;
}

export function renderTemplate(
  blocks: Block[],
  articles: ArticleForRender[] = []
): string {
  const bodyContent = blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return renderHeader(block.content);
        case "text":
          return renderText(block.content);
        case "image":
          return renderImage(block.content);
        case "articles":
          return renderArticles(block.content, articles);
        case "divider":
          return renderDivider();
        case "button":
          return renderButton(block.content);
        case "footer":
          return renderFooter(block.content);
        default:
          return "";
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>The Gist Decatur</title>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="wrapper">
    ${bodyContent}
  </div>
</body>
</html>`;
}
