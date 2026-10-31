import { escapeHtml } from "./html";
import { applyMergeTags, type NurtureBlock } from "./sponsor-nurture-shared";

// Renders nurture email blocks into a complete, email-safe HTML document.
// Pure string building: used by the send/test-send routes and by the admin
// editor's live preview (with sample merge data).

export interface NurtureRenderContext {
  businessName: string;
  contactName: string;
  workspaceName: string;
  brandColor: string;
  /** Site origin used to absolutize relative block links ("" in previews). */
  appUrl: string;
  portalUrl: string;
  unsubscribeUrl: string;
}

function abs(url: string, ctx: NurtureRenderContext): string {
  return url.startsWith("/") && ctx.appUrl ? `${ctx.appUrl}${url}` : url;
}

function renderBlock(block: NurtureBlock, ctx: NurtureRenderContext): string {
  const recipient = { businessName: ctx.businessName, contactName: ctx.contactName };
  switch (block.type) {
    case "heading":
      return `<h2 style="margin: 0 0 14px; color: #111827; font-size: 22px; line-height: 1.3;">${escapeHtml(applyMergeTags(block.text || "", recipient))}</h2>`;
    case "text": {
      const merged = escapeHtml(applyMergeTags(block.text || "", recipient));
      const paragraphs = merged
        .split(/\n\s*\n/)
        .map((p) => `<p style="margin: 0 0 14px; color: #374151; font-size: 15px; line-height: 1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      return paragraphs;
    }
    case "image": {
      if (!block.url) return "";
      const img = `<img src="${escapeHtml(abs(block.url, ctx))}" alt="${escapeHtml(block.alt || "")}" style="display: block; width: 100%; max-width: 552px; height: auto; border-radius: 10px;" />`;
      const wrapped = block.linkUrl
        ? `<a href="${escapeHtml(abs(block.linkUrl, ctx))}" target="_blank" rel="noopener noreferrer">${img}</a>`
        : img;
      return `<div style="margin: 0 0 18px;">${wrapped}</div>`;
    }
    case "button": {
      if (!block.linkUrl) return "";
      return `<p style="margin: 6px 0 20px; text-align: center;"><a href="${escapeHtml(abs(block.linkUrl, ctx))}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: ${ctx.brandColor}; color: #ffffff; padding: 13px 26px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">${escapeHtml(block.label || "Learn more")}</a></p>`;
    }
    case "divider":
      return `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />`;
    default:
      return "";
  }
}

export function renderNurtureEmail(blocks: NurtureBlock[], ctx: NurtureRenderContext): string {
  const body = blocks.map((b) => renderBlock(b, ctx)).join("\n");
  return `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background: #f3f4f6;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: ${ctx.brandColor}; border-radius: 14px 14px 0 0; padding: 18px 24px;">
      <span style="color: #ffffff; font-size: 17px; font-weight: 700;">${escapeHtml(ctx.workspaceName)}</span>
      <span style="color: rgba(255,255,255,0.75); font-size: 12px; display: block; margin-top: 2px;">For local businesses</span>
    </div>
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 14px 14px; padding: 24px;">
      ${body}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 22px 0 16px;" />
      <p style="margin: 0 0 10px; color: #6b7280; font-size: 13px; line-height: 1.5;">
        Manage your free listing, book a campaign, and check your results any time in your
        <a href="${escapeHtml(ctx.portalUrl)}" style="color: ${ctx.brandColor}; font-weight: 600;">sponsor portal</a>.
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
        You're receiving this because ${escapeHtml(ctx.businessName)} is listed free with ${escapeHtml(ctx.workspaceName)}.
        <a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color: #9ca3af;">Unsubscribe from business tips</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function renderNurtureSubject(subject: string, recipient: { businessName: string; contactName: string }): string {
  return applyMergeTags(subject || "", recipient);
}
