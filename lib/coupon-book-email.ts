import { getWorkspaceUrl, withWorkspace } from "@/lib/workspace";
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
      const bookUrl = `${workspaceUrl}/coupons?token=${opts.magicToken}`;
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (!client) return;
      await client.sendEmail({
        to: opts.to,
        subject: `Your Gist Coupon Book is ready`,
        htmlBody: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #111827; margin: 0 0 12px;">Your Coupon Book</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Thanks for grabbing the Gist Coupon Book! Tap below to open your book and see your personal QR code. Show the QR code at any participating business and they'll scan it to apply your discount.
      </p>
      <p style="margin: 24px 0;">
        <a href="${bookUrl}" style="background: #24726f; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Open My Coupon Book
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or copy this link: ${bookUrl}</p>
      <p style="color: #9ca3af; font-size: 12px;">This link is unique to you. If you didn't buy a coupon book, you can ignore this email.</p>
    </div>
  `,
      });
    });
  } catch (err) {
    console.error("Failed to send coupon book magic link email:", err);
  }
}

// Notify the business owner each time one of their coupons is redeemed.
export async function sendCouponRedemptionEmail(opts: {
  workspaceId: string;
  to: string;
  businessName: string;
  couponTitle: string;
  buyerEmail: string;
}): Promise<void> {
  try {
    await withWorkspaceById(opts.workspaceId, async () => {
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (!client) return;
      await client.sendEmail({
        to: opts.to,
        subject: `Coupon redeemed: ${opts.couponTitle}`,
        htmlBody: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #111827; margin: 0 0 12px;">Coupon redeemed</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        A reader just redeemed <strong>${escapeHtml(opts.couponTitle)}</strong> at ${escapeHtml(opts.businessName)}
        via the Gist Coupon Book.
      </p>
      <p style="color: #9ca3af; font-size: 12px;">This is an automated notification from the Gist Coupon Book.</p>
    </div>
  `,
      });
    });
  } catch (err) {
    console.error("Failed to send coupon redemption email:", err);
  }
}
