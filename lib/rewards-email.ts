import { getWorkspace, getWorkspaceUrl, withWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getEmailClient } from "@/lib/email";

async function withWorkspaceById<T>(workspaceId: string, task: () => Promise<T>): Promise<T> {
  const workspace = await basePrisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error(`Unknown workspace ${workspaceId}`);
  return withWorkspace(workspace, task);
}

// The reader's personal Rewards link. Reader identity on this site is the
// subscriber's email (the same identity the /contest page and the rewards
// API use), so the link is the /rewards page with the email filled in:
// clicking it lands the reader on their own points page, no password. It
// grants exactly what typing the email into the /rewards form grants.
export function rewardsPortalUrl(workspaceUrl: string, email: string): string {
  return `${workspaceUrl}/rewards?email=${encodeURIComponent(email)}`;
}

// Portal-link email for Reader Rewards, modeled on the coupon book magic
// link email (sendCouponBookMagicLinkEmail): same workspace settings,
// same email client, same from-address for the city.
export async function sendRewardsPortalLinkEmail(opts: {
  workspaceId: string;
  to: string;
}): Promise<void> {
  try {
    await withWorkspaceById(opts.workspaceId, async () => {
      const workspaceUrl = await getWorkspaceUrl();
      const rewardsUrl = rewardsPortalUrl(workspaceUrl, opts.to);
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (!client) throw new Error("No email provider configured for this workspace");
      const ws = await getWorkspace();
      await client.sendEmail({
        to: opts.to,
        subject: `Your ${ws.name} Rewards link`,
        htmlBody: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #111827; margin: 0 0 12px;">Your Reader Rewards</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Here&apos;s your personal link to your ${ws.name} Rewards page: your points
        balance, your recent activity, and what your points can get you. You earn
        points for referring friends and shopping with ${ws.name} — 100 points = $1.
        No password needed.
      </p>
      <p style="margin: 24px 0;">
        <a href="${rewardsUrl}" style="background: #15803d; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          See My Points
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or copy this link: ${rewardsUrl}</p>
      <p style="color: #9ca3af; font-size: 12px;">This link is personal to you. If you didn't ask for it, you can ignore this email.</p>
    </div>
  `,
      });
    });
  } catch (err) {
    console.error("Failed to send rewards portal link email:", err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
