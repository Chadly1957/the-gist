import { getWorkspace, getWorkspaceUrl, withWorkspace } from "@/lib/workspace";
import { escapeHtml } from "@/lib/html";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getEmailClient } from "@/lib/email";

async function withWorkspaceById<T>(workspaceId: string, task: () => Promise<T>): Promise<T> {
  const workspace = await basePrisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error(`Unknown workspace ${workspaceId}`);
  return withWorkspace(workspace, task);
}

// Magic link that opens the reader's coupon book dashboard (no passwords).
export async function sendCouponBookMagicLinkEmail(opts: {
  workspaceId: string;
  to: string;
  magicToken: string;
}): Promise<void> {
  try {
    await withWorkspaceById(opts.workspaceId, async () => {
      const workspaceUrl = await getWorkspaceUrl();
      const bookUrl = `${workspaceUrl}/deals?token=${opts.magicToken}`;
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (!client) throw new Error("No email provider configured for this workspace");
      const ws = await getWorkspace();
      const logoHtml = ws.dealsLogoUrl
        ? `<img src="${escapeHtml(ws.dealsLogoUrl)}" alt="The Gist Deals" style="height: 96px; width: auto; display: block; margin: 0 0 16px;" />`
        : "";
      await client.sendEmail({
        to: opts.to,
        subject: `Your Gist Deals Book is ready`,
        htmlBody: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      ${logoHtml}
      <h2 style="color: #111827; margin: 0 0 12px;">Your Gist Deals Book</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Thanks for grabbing the Gist Deals Book! Tap below to open your book and see your deals and local coupons. Refreshed every week.
      </p>
      <p style="margin: 24px 0;">
        <a href="${bookUrl}" style="background: #24726f; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Open My Gist Deals Book
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or copy this link: ${bookUrl}</p>
      <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 16px;">
        <p style="color: #111827; font-size: 14px; font-weight: bold; margin: 0 0 8px;">Also included with your book</p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0 0 8px;">
          <strong>The Friday Deal Drop.</strong> Every Friday, the week&apos;s best new deals land in your inbox. You&apos;re on the list.
        </p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0;">
          <strong>Deal Savings Tracker.</strong> Log every deal you use and watch the book pay for itself:
          <a href="${workspaceUrl}/deals/tracker" style="color: #24726f; font-weight: 600;">open your printable tracker</a>
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px;">This link is unique to you. If you didn't get a Gist Deals Book, you can ignore this email.</p>
    </div>
  `,
      });
    });
  } catch (err) {
    console.error("Failed to send coupon book magic link email:", err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// Gift email: tells the recipient who sent the book, shows their message,
// and gives them their magic link. The buyer (gifter) gets Stripe's own
// receipt; no separate buyer email is sent.
export async function sendCouponBookGiftEmail(opts: {
  workspaceId: string;
  to: string;
  magicToken: string;
  gifterName: string;
  gifterEmail: string;
  giftMessage: string;
}): Promise<void> {
  try {
    await withWorkspaceById(opts.workspaceId, async () => {
      const workspaceUrl = await getWorkspaceUrl();
      const bookUrl = `${workspaceUrl}/deals?token=${opts.magicToken}`;
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (!client) throw new Error("No email provider configured for this workspace");
      const ws = await getWorkspace();
      const logoHtml = ws.dealsLogoUrl
        ? `<img src="${escapeHtml(ws.dealsLogoUrl)}" alt="The Gist Deals" style="height: 96px; width: auto; display: block; margin: 0 0 16px;" />`
        : "";
      const fromLabel = opts.gifterName || opts.gifterEmail;
      await client.sendEmail({
        to: opts.to,
        subject: `${fromLabel} sent you a Gist Deals Book`,
        htmlBody: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      ${logoHtml}
      <h2 style="color: #111827; margin: 0 0 12px;">You got a gift!</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        <strong>${escapeHtml(fromLabel)}</strong> bought you the Gist Deals Book, every deal worth
        knowing about, in one little book on your phone. It covers your first year of the book, on
        them. When the year is up, you can renew for $15 a year or let it lapse, your call.
      </p>
      ${opts.giftMessage ? `<div style="background: #f9fafb; border-left: 3px solid #24726f; padding: 12px 16px; margin: 16px 0;"><p style="color: #4b5563; font-size: 14px; font-style: italic; margin: 0;">&ldquo;${escapeHtml(opts.giftMessage)}&rdquo;</p></div>` : ""}
      <p style="margin: 24px 0;">
        <a href="${bookUrl}" style="background: #24726f; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Open My Gist Deals Book
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or copy this link: ${bookUrl}</p>
      <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 16px;">
        <p style="color: #111827; font-size: 14px; font-weight: bold; margin: 0 0 8px;">Also included with your book</p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0 0 8px;">
          <strong>The Friday Deal Drop.</strong> Every Friday, the week&apos;s best new deals land in your inbox. You&apos;re on the list.
        </p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0;">
          <strong>Deal Savings Tracker.</strong> Log every deal you use and watch the book pay for itself:
          <a href="${workspaceUrl}/deals/tracker" style="color: #24726f; font-weight: 600;">open your printable tracker</a>
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px;">This link is unique to you. If you weren&apos;t expecting a Gist Deals Book, you can ignore this email.</p>
    </div>
  `,
      });
    });
  } catch (err) {
    console.error("Failed to send coupon book gift email:", err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// Notify the business owner each time one of their coupons is redeemed.
export async function sendCouponRedemptionEmail(opts: {
  workspaceId: string;
  to: string;
  businessName: string;
  couponTitle: string;
  buyerEmail: string;
  redeemedAt: Date;
  notes: string;
}): Promise<void> {
  try {
    await withWorkspaceById(opts.workspaceId, async () => {
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (!client) throw new Error("No email provider configured for this workspace");
      const ws = await getWorkspace();
      const logoHtml = ws.dealsLogoUrl
        ? `<img src="${escapeHtml(ws.dealsLogoUrl)}" alt="The Gist Deals" style="height: 48px; width: auto; display: block; margin: 0 0 16px;" />`
        : "";
      const when = opts.redeemedAt.toLocaleString("en-US", { timeZone: ws.timezone || "America/Chicago" });
      await client.sendEmail({
        to: opts.to,
        subject: `Deal redeemed: ${opts.couponTitle}`,
        htmlBody: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      ${logoHtml}
      <h2 style="color: #111827; margin: 0 0 12px;">Deal redeemed</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        <strong>${escapeHtml(opts.buyerEmail)}</strong> just redeemed <strong>${escapeHtml(opts.couponTitle)}</strong>
        at ${escapeHtml(opts.businessName)} via The Gist Deals.
      </p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        <span style="color: #9ca3af;">When:</span> ${escapeHtml(when)}
      </p>
      ${opts.notes ? `<p style="color: #4b5563; font-size: 14px; line-height: 1.5;"><span style="color: #9ca3af;">Notes:</span> ${escapeHtml(opts.notes)}</p>` : ""}
      <p style="color: #9ca3af; font-size: 12px;">This is an automated notification from The Gist Deals. Redemptions are also logged in your sponsor portal.</p>
    </div>
  `,
      });
    });
  } catch (err) {
    console.error("Failed to send coupon redemption email:", err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// Magic link for a guide-only buyer: opens the stripped portal (their guides
// plus the upgrade card) at the guide's section. Same no-password pattern
// as the book link.
export async function sendMiniMagicLinkEmail(opts: {
  workspaceId: string;
  to: string;
  magicToken: string;
  miniTitle: string;
  miniSlug: string;
}): Promise<void> {
  try {
    await withWorkspaceById(opts.workspaceId, async () => {
      const workspaceUrl = await getWorkspaceUrl();
      const guideUrl = `${workspaceUrl}/deals?token=${opts.magicToken}#guide-${opts.miniSlug}`;
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (!client) throw new Error("No email provider configured for this workspace");
      const ws = await getWorkspace();
      const logoHtml = ws.dealsLogoUrl
        ? `<img src="${escapeHtml(ws.dealsLogoUrl)}" alt="The Gist Deals" style="height: 96px; width: auto; display: block; margin: 0 0 16px;" />`
        : "";
      await client.sendEmail({
        to: opts.to,
        subject: `Your ${opts.miniTitle} is ready`,
        htmlBody: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      ${logoHtml}
      <h2 style="color: #111827; margin: 0 0 12px;">Your ${escapeHtml(opts.miniTitle)}</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Thanks for grabbing the ${escapeHtml(opts.miniTitle)}! Tap below to open your guide.
      </p>
      <p style="margin: 24px 0;">
        <a href="${guideUrl}" style="background: #24726f; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Open My Guide
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or copy this link: ${guideUrl}</p>
      <p style="color: #9ca3af; font-size: 12px;">This link is unique to you. If you weren't expecting a guide, you can ignore this email.</p>
    </div>
  `,
      });
    });
  } catch (err) {
    console.error("Failed to send mini magic link email:", err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
