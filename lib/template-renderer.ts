// Converts template block JSON into a full HTML email string

export interface Block {
  id: string;
  type: "header" | "text" | "image" | "articles" | "divider" | "footer" | "button" | "spotlight" | "presenting_sponsor" | "events" | "referral" | "poll";
  content: Record<string, unknown>;
}

export interface PollOptionData {
  id: string;
  label: string;
}

export interface PollData {
  pollId: string;
  appUrl: string;
  options: PollOptionData[];
}

export interface EventItem {
  title: string;
  description?: string | null;
  eventDate: string; // YYYY-MM-DD
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  url?: string | null;
  cost?: string | null;
}

export interface SpotlightItem {
  businessName: string;
  logoUrl?: string | null;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
}

export interface PresentingSponsorItem {
  businessName: string;
  logoUrl?: string | null;
  headline: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
  imageUrl?: string | null;
  presentingBlurb?: string | null;
}

export interface InArticleAdItem {
  businessName: string;
  headline: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
  imageUrl?: string | null;
}

export interface ArticleForRender {
  title: string;
  description: string;
  imageUrl: string | null;
  articleUrl: string;
  sourceName: string;
  publishedAt: Date | string;
}

// Passed by server callers only (e.g. the send route) so this module never
// has to import a Node-only signing implementation itself — it stays safe
// to bundle into client components that render live previews.
export interface TrackingConfig {
  baseUrl: string;
  sign: (url: string) => string;
}

// The actual recipient id is substituted in after rendering, once per
// recipient, so the template only needs to be rendered once per send.
const RECIPIENT_PLACEHOLDER = "RIDPLACEHOLDER";

function trackedUrl(
  tracking: TrackingConfig | undefined,
  url: string,
  type: string,
  label?: string
): string {
  if (!tracking || !url) return url;
  const params = new URLSearchParams({
    r: RECIPIENT_PLACEHOLDER,
    u: url,
    t: type,
    s: tracking.sign(url),
  });
  if (label) params.set("l", label);
  return `${tracking.baseUrl}/api/track/click?${params.toString()}`;
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
  const pt = Number(content.paddingTop ?? 0);
  const pr = Number(content.paddingRight ?? 0);
  const pb = Number(content.paddingBottom ?? 0);
  const pl = Number(content.paddingLeft ?? 0);
  const hasNoPadding = pt === 0 && pr === 0 && pb === 0 && pl === 0;
  const imgStyle = `max-width:100%;height:auto;display:block;${hasNoPadding ? "" : "border-radius:6px;"}`;
  return `
    <div style="padding:${pt}px ${pr}px ${pb}px ${pl}px;">
      <img src="${content.url}" alt="${content.alt || ""}" style="${imgStyle}" />
      ${content.caption ? `<p style="font-size:12px;color:#6b7280;margin:6px ${pl > 0 ? 0 : 4}px 0;font-family:sans-serif;">${content.caption}</p>` : ""}
    </div>`;
}

function renderArticles(
  content: Record<string, unknown>,
  articles: ArticleForRender[],
  ads: InArticleAdItem[] = [],
  tracking?: TrackingConfig
): string {
  if (articles.length === 0 && ads.length === 0) return "";

  const articleCards = articles.map((a) => {
    const cardUrl = trackedUrl(tracking, a.articleUrl, "article", a.title);
    return `
      <a href="${cardUrl}" class="article-card" style="display:block;margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;text-decoration:none;">
        ${a.imageUrl ? `<img src="${a.imageUrl}" alt="" class="article-img" style="width:100%;height:180px;object-fit:cover;display:block;" />` : `<div class="article-img-placeholder"></div>`}
        <div class="article-body" style="padding:16px;">
          <div class="article-source" style="font-family:sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:6px;">${a.sourceName}</div>
          <div class="article-title" style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px;font-family:Georgia,serif;line-height:1.3;">${a.title}</div>
          <div class="article-desc" style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 12px;font-family:sans-serif;">${a.description}</div>
          <a href="${cardUrl}" class="read-more" style="display:inline-block;background:#166534;color:#ffffff;padding:8px 18px;border-radius:4px;text-decoration:none;font-size:13px;font-family:sans-serif;font-weight:600;">Read More</a>
        </div>
      </a>`;
  });

  // Weave ads between articles at even intervals
  const combined: string[] = [];
  const interval = ads.length > 0 ? Math.ceil(articleCards.length / (ads.length + 1)) : articleCards.length;
  let adIdx = 0;
  articleCards.forEach((card, i) => {
    combined.push(card);
    if (ads[adIdx] && (i + 1) % interval === 0) {
      combined.push(renderInArticleAd(ads[adIdx], tracking));
      adIdx++;
    }
  });
  while (adIdx < ads.length) { combined.push(renderInArticleAd(ads[adIdx++], tracking)); }

  return `
    <div class="block">
      ${content.label ? `<div class="section-label">${content.label}</div>` : ""}
      ${combined.join("")}
    </div>`;
}

function renderSpotlight(items: SpotlightItem[], tracking?: TrackingConfig): string {
  if (items.length === 0) return "";
  const cards = items.map((s) => {
    const ctaUrl = trackedUrl(tracking, s.ctaUrl, "spotlight", s.businessName);
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;">
      <tr>
        <td width="88" valign="top" style="padding:14px 0 14px 14px;">
          ${s.logoUrl
            ? `<img src="${s.logoUrl}" alt="${s.businessName}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:6px;object-fit:contain;border:1px solid #f3f4f6;" />`
            : `<div style="width:72px;height:72px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;"></div>`}
        </td>
        <td valign="middle" style="padding:14px;">
          <div style="font-size:14px;font-weight:700;color:#111827;font-family:sans-serif;margin-bottom:4px;">${s.businessName}</div>
          <div style="font-size:13px;color:#4b5563;line-height:1.5;font-family:sans-serif;margin-bottom:10px;">${s.description}</div>
          <a href="${ctaUrl}" style="display:inline-block;background:#166534;color:#ffffff;padding:7px 14px;border-radius:4px;text-decoration:none;font-size:12px;font-family:sans-serif;font-weight:600;white-space:nowrap;">${s.ctaLabel}</a>
        </td>
      </tr>
    </table>`;
  }).join("");

  return `
    <div style="padding:20px 40px;">
      <div style="font-family:sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
        Community Partners
      </div>
      ${cards}
    </div>`;
}

function renderPresentingSponsor(item: PresentingSponsorItem, tracking?: TrackingConfig): string {
  const blurb = item.presentingBlurb ||
    `Today&rsquo;s Gist Decatur is brought to you by <strong>${item.businessName}</strong>.`;
  const ctaUrl = trackedUrl(tracking, item.ctaUrl, "presenting_sponsor", item.businessName);
  return `
    <div style="padding:20px 40px;">
      <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="font-family:sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#854d0e;margin-bottom:8px;">Presenting Sponsor</div>
        <p style="font-size:14px;color:#713f12;line-height:1.6;font-family:sans-serif;margin:0;">${blurb}</p>
      </div>
      ${item.imageUrl ? `<img src="${item.imageUrl}" alt="" style="max-width:100%;height:auto;display:block;border-radius:6px;margin-bottom:14px;" />` : ""}
      <div style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px;font-family:Georgia,serif;line-height:1.3;">${item.headline}</div>
      <div style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 14px;font-family:sans-serif;">${item.body}</div>
      <a href="${ctaUrl}" style="display:inline-block;background:#166534;color:#ffffff;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:13px;font-family:sans-serif;font-weight:600;">${item.ctaLabel}</a>
    </div>`;
}

function renderInArticleAd(ad: InArticleAdItem, tracking?: TrackingConfig): string {
  const ctaUrl = trackedUrl(tracking, ad.ctaUrl, "in_article_ad", ad.businessName);
  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;background:#fafafa;">
      <div style="padding:6px 14px;background:#f3f4f6;font-family:sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">
        Advertisement
      </div>
      ${ad.imageUrl ? `<img src="${ad.imageUrl}" alt="" style="width:100%;height:200px;object-fit:cover;display:block;" />` : ""}
      <div style="padding:16px;">
        <div style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px;font-family:Georgia,serif;line-height:1.3;">${ad.headline}</div>
        <div style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 14px;font-family:sans-serif;">${ad.body}</div>
        <a href="${ctaUrl}" style="display:inline-block;background:#166534;color:#ffffff;padding:8px 18px;border-radius:4px;text-decoration:none;font-size:13px;font-family:sans-serif;font-weight:600;">${ad.ctaLabel}</a>
      </div>
    </div>`;
}

function renderEvents(events: EventItem[]): string {
  if (events.length === 0) return "";
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  function fmtDate(d: string): string {
    const [y, m, day] = d.split("-").map(Number);
    const dt = new Date(y, m - 1, day);
    return `${DAYS[dt.getDay()]}, ${MONTHS[m - 1]} ${day}`;
  }
  const items = events.map((e) => {
    const timeParts = [e.startTime, e.endTime].filter(Boolean).join(" – ");
    const meta = [timeParts, e.location, e.cost].filter(Boolean).join(" · ");
    return `
      <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #f3f4f6;">
        <div style="font-size:11px;font-weight:700;color:#166534;font-family:sans-serif;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${fmtDate(e.eventDate)}</div>
        <div style="font-size:15px;font-weight:700;color:#111827;font-family:sans-serif;line-height:1.3;margin-bottom:4px;">${e.title}</div>
        ${meta ? `<div style="font-size:12px;color:#6b7280;font-family:sans-serif;margin-bottom:4px;">${meta}</div>` : ""}
        ${e.description ? `<div style="font-size:13px;color:#4b5563;line-height:1.5;font-family:sans-serif;margin-bottom:4px;">${e.description}</div>` : ""}
        ${e.url ? `<a href="${e.url}" style="font-size:12px;color:#166534;font-family:sans-serif;font-weight:600;text-decoration:none;">More info →</a>` : ""}
      </div>`;
  }).join("");
  return `
    <div style="padding:20px 40px;">
      <div style="font-family:sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
        Upcoming Events
      </div>
      ${items}
    </div>`;
}

// REFCODEPLACEHOLDER is substituted per-recipient in the send route
// {{APP_URL}} is substituted by the send/test route with the actual app URL
function renderReferral(content: Record<string, unknown>): string {
  const title = String(content.title || "Refer a Friend, Earn Rewards");
  const text = String(content.text || "Know someone who'd love The Gist Decatur? Share your unique link and earn a chance to win a prize!");
  const label = String(content.buttonLabel || "Share Your Referral Link →");
  const referUrl = "{{APP_URL}}/refer/REFCODEPLACEHOLDER";
  return `
    <div style="padding:20px 40px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:24px;text-align:center;">
        <div style="font-family:sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#166534;margin-bottom:10px;">Refer a Friend</div>
        <div style="font-size:18px;font-weight:700;color:#111827;font-family:Georgia,serif;line-height:1.3;margin-bottom:10px;">${title}</div>
        <div style="font-size:14px;color:#4b5563;line-height:1.6;font-family:sans-serif;margin-bottom:20px;">${text}</div>
        <a href="${referUrl}" style="display:inline-block;background:#166534;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-family:sans-serif;font-weight:700;">${label}</a>
      </div>
    </div>`;
}

function renderPoll(content: Record<string, unknown>, polls?: Map<string, PollData>): string {
  const question = String(content.question || "What do you think?");
  const blockId = String(content.blockId || "");
  const pollData = blockId ? polls?.get(blockId) : undefined;

  let optionsHtml: string;
  if (pollData) {
    optionsHtml = pollData.options.map((opt) => {
      const voteUrl = `${pollData.appUrl}/poll/${pollData.pollId}/${opt.id}?r=${RECIPIENT_PLACEHOLDER}`;
      return `
        <tr><td style="padding:5px 0;">
          <a href="${voteUrl}" style="display:block;width:100%;box-sizing:border-box;padding:11px 18px;border:2px solid #166534;border-radius:6px;text-decoration:none;font-size:14px;font-family:sans-serif;font-weight:600;color:#166534;text-align:center;">${opt.label}</a>
        </td></tr>`;
    }).join("");
  } else {
    // Preview mode — render static buttons for each option in content
    const rawOptions = (content.options as string[] | undefined)
      || [content.option0, content.option1, content.option2, content.option3];
    const options = (rawOptions as (string | undefined)[]).map(String).filter(Boolean);
    optionsHtml = options.map((label: string) => `
        <tr><td style="padding:5px 0;">
          <div style="display:block;padding:11px 18px;border:2px solid #d1d5db;border-radius:6px;font-size:14px;font-family:sans-serif;font-weight:600;color:#6b7280;text-align:center;">${label}</div>
        </td></tr>`).join("");
  }

  return `
    <div style="padding:20px 40px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:24px;">
        <div style="font-family:sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#166534;margin-bottom:12px;">Quick Poll</div>
        <div style="font-size:17px;font-weight:700;color:#111827;font-family:Georgia,serif;line-height:1.4;margin-bottom:16px;">${question}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${optionsHtml}
        </table>
      </div>
    </div>`;
}

function renderDivider(): string {
  return `<div class="block" style="padding:8px 40px;"><hr class="divider" style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></div>`;
}

function renderButton(content: Record<string, unknown>, tracking?: TrackingConfig): string {
  if (!content.url) return "";
  const url = trackedUrl(tracking, String(content.url), "button", content.label ? String(content.label) : undefined);
  return `
    <div class="button-block">
      <a href="${url}" class="cta-button">${content.label || "Read More"}</a>
    </div>`;
}

function renderFooter(content: Record<string, unknown>): string {
  return `
    <div class="footer">
      <p>${content.text || "You are receiving this because you subscribed to The Gist Decatur."}</p>
      <p>
        <a href="{{UNSUBSCRIBE_URL}}">${content.unsubscribeText || "Unsubscribe"}</a>
        &nbsp;·&nbsp;
        <a href="{{PROFILE_URL}}" style="color:#6b7280;">Update your name</a>
      </p>
    </div>`;
}

export function renderTemplate(
  blocks: Block[],
  articles: ArticleForRender[] = [],
  sponsors: {
    spotlights?: SpotlightItem[];
    presentingSponsor?: PresentingSponsorItem | null;
    inArticleAds?: InArticleAdItem[];
  } = {},
  tracking?: TrackingConfig,
  events: EventItem[] = [],
  polls?: Map<string, PollData>
): string {
  const { spotlights = [], presentingSponsor = null, inArticleAds = [] } = sponsors;

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
          return renderArticles(block.content, articles, inArticleAds, tracking);
        case "divider":
          return renderDivider();
        case "button":
          return renderButton(block.content, tracking);
        case "footer":
          return renderFooter(block.content);
        case "spotlight":
          return renderSpotlight(spotlights, tracking);
        case "presenting_sponsor":
          return presentingSponsor ? renderPresentingSponsor(presentingSponsor, tracking) : "";
        case "events":
          return renderEvents(events);
        case "referral":
          return renderReferral(block.content);
        case "poll":
          return renderPoll(block.content, polls);
        default:
          return "";
      }
    })
    .join("\n");

  const openPixel = tracking
    ? `<img src="${tracking.baseUrl}/api/track/open?r=${RECIPIENT_PLACEHOLDER}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
    : "";

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
  ${openPixel}
</body>
</html>`;
}
