import { getWorkspace } from "@/lib/workspace";
import { escapeHtml } from "@/lib/html";
import { prisma } from "@/lib/db";
import { getEmailClient } from "@/lib/email";

const FALLBACK_COLOR = "#24726f";

function accent(workspace: { primaryColor?: string | null }): string {
  return workspace.primaryColor || FALLBACK_COLOR;
}

function shell(inner: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
      ${inner}
    </div>
  `;
}

function button(accentColor: string, url: string, label: string): string {
  return `
    <p style="margin: 24px 0;">
      <a href="${url}" style="background: ${accentColor}; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
        ${escapeHtml(label)}
      </a>
    </p>
  `;
}

function statCell(label: string, value: string): string {
  return `
    <td style="text-align: center; padding: 16px 8px;">
      <div style="font-size: 28px; font-weight: 700; color: #111827;">${escapeHtml(value)}</div>
      <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${escapeHtml(label)}</div>
    </td>
  `;
}

async function loadClient() {
  const workspace = await getWorkspace();
  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const client = await getEmailClient(settings);
  return { workspace, settings, client };
}

export async function sendWeekBookingConfirmation(args: {
  to: string; contactName: string; businessName: string; tierLabel: string;
  weekLabel: string; portalUrl: string; chadWritesCopy: boolean;
}): Promise<boolean> {
  try {
    const { workspace, client } = await loadClient();
    if (!client) return false;
    const a = accent(workspace);
    const nextStep = args.chadWritesCopy
      ? "Chad is writing your ad copy now. It will be reviewed and live before your week starts, no action needed from you."
      : "Your ad copy is locked in. It will be live in every issue during your sponsor week.";

    const html = shell(`
      <h2 style="color: #111827; margin: 0 0 12px;">You're booked, ${escapeHtml(args.contactName)}</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Thanks for sponsoring ${escapeHtml(workspace.name)}. Your payment went through and your slot is confirmed.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 12px;">
        <tr>
          <td style="padding: 16px;">
            <div style="font-size: 13px; color: #6b7280;">Business</div>
            <div style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 8px;">${escapeHtml(args.businessName)}</div>
            <div style="font-size: 13px; color: #6b7280;">Package</div>
            <div style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 8px;">${escapeHtml(args.tierLabel)}</div>
            <div style="font-size: 13px; color: #6b7280;">Sponsor week</div>
            <div style="font-size: 15px; font-weight: 600; color: #111827;">${escapeHtml(args.weekLabel)}</div>
          </td>
        </tr>
      </table>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">${escapeHtml(nextStep)}</p>
      ${button(a, args.portalUrl, "Manage My Sponsorship")}
      <p style="color: #9ca3af; font-size: 12px;">Questions? Just reply to this email.</p>
    `);

    await client.sendEmail({
      to: args.to,
      subject: `Booking confirmed: ${args.tierLabel}, ${args.weekLabel}`,
      htmlBody: html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send week booking confirmation email:", err);
    return false;
  }
}

/**
 * Owner FYI notification: the instant a week locks in, Chad gets the booking
 * details. This is informational, not an approval gate: the ad auto-places
 * and runs without any review. The only action item is the optional ~10-min
 * copy polish when the sponsor asked Chad to write the ad, flagged by the
 * subject line. Returns true when the email was accepted for sending.
 */
export async function sendOwnerBookingNotification(args: {
  businessName: string; tierLabel: string; weekLabel: string; amountCents: number;
  contactName: string; buyerEmail: string; aboutText: string; logoUrl: string;
  chadWritesCopy: boolean; adminUrl: string;
}): Promise<boolean> {
  try {
    const { settings, client } = await loadClient();
    if (!client) return false;
    const to = settings["owner_email"] || process.env.ADMIN_EMAIL || "";
    if (!to) {
      console.log("Skipping owner booking notification: no owner_email setting or ADMIN_EMAIL configured.");
      return false;
    }

    const amount = `$${(args.amountCents / 100).toFixed(0)}`;
    const subject = args.chadWritesCopy
      ? `Copy needed: ${args.businessName} booked ${args.weekLabel}`
      : `Booked: ${args.businessName} - ${args.weekLabel} (no action)`;

    const actionBlock = args.chadWritesCopy
      ? `
      <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="color: #92400e; font-size: 14px; font-weight: 700; margin: 0 0 8px;">Action needed: write the ad copy (about 10 minutes)</p>
        <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0;">
          The buyer asked you to write their ad. Open the booking in admin, write the copy in the queue,
          and mark it finalized before the week starts. Nothing else needs your review.
        </p>
      </div>`
      : `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="color: #166534; font-size: 14px; font-weight: 700; margin: 0 0 8px;">No action needed</p>
        <p style="color: #166534; font-size: 14px; line-height: 1.5; margin: 0;">
          The buyer provided their own copy, so the ad auto-placed and will run as scheduled.
          You do not need to review, adjust, or approve anything.
        </p>
      </div>`;

    const html = shell(`
      <h2 style="color: #111827; margin: 0 0 12px;">New paid booking: ${escapeHtml(args.businessName)}</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 12px;">
        <tr>
          <td style="padding: 16px; font-size: 14px; color: #4b5563; line-height: 1.9;">
            <strong style="color: #111827;">Business:</strong> ${escapeHtml(args.businessName)}<br />
            <strong style="color: #111827;">Package:</strong> ${escapeHtml(args.tierLabel)}<br />
            <strong style="color: #111827;">Week:</strong> ${escapeHtml(args.weekLabel)}<br />
            <strong style="color: #111827;">Amount paid:</strong> ${escapeHtml(amount)}<br />
            <strong style="color: #111827;">Buyer:</strong> ${escapeHtml(args.contactName)} &lt;${escapeHtml(args.buyerEmail)}&gt;<br />
            <strong style="color: #111827;">Ad copy:</strong> ${args.chadWritesCopy ? "Chad writes it" : "Buyer provided it"}
          </td>
        </tr>
      </table>
      ${actionBlock}
      <p style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 4px;">What the buyer told readers:</p>
      <blockquote style="border-left: 3px solid #e5e7eb; margin: 0 0 16px; padding: 4px 0 4px 12px; color: #4b5563; font-size: 14px; line-height: 1.5;">
        ${escapeHtml(args.aboutText)}
      </blockquote>
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(args.logoUrl)}">
          <img src="${escapeHtml(args.logoUrl)}" alt="${escapeHtml(args.businessName)} logo" style="max-width: 240px; max-height: 120px; border-radius: 8px;" />
        </a>
      </p>
      ${button(FALLBACK_COLOR, args.adminUrl, "Open Booking in Admin")}
    `);

    const result = await client.sendEmail({ to, subject, htmlBody: html });
    return result.success;
  } catch (err) {
    console.error("Failed to send owner booking notification:", err);
    return false;
  }
}

/**
 * Loud failure alarm: payment was captured but something downstream failed
 * (slot not locked, confirmation unsent, ad not placed). This is the alarm
 * that prevents another silent September-style miss. Returns true when the
 * alarm email was accepted for sending.
 */
export async function sendFulfillmentAlert(args: {
  businessName: string; tierLabel: string; weekLabel: string; amountCents: number;
  contactName: string; buyerEmail: string; failureSummary: string; adminUrl: string;
}): Promise<boolean> {
  try {
    const { settings, client } = await loadClient();
    if (!client) return false;
    const to = settings["owner_email"] || process.env.ADMIN_EMAIL || "";
    if (!to) {
      console.error("ALERT UNSENDABLE: no owner_email setting or ADMIN_EMAIL configured.", args.failureSummary);
      return false;
    }

    const amount = `$${(args.amountCents / 100).toFixed(0)}`;
    const when = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

    const html = shell(`
      <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="color: #991b1b; font-size: 16px; font-weight: 700; margin: 0 0 8px;">A paid booking did not complete cleanly</p>
        <p style="color: #991b1b; font-size: 14px; line-height: 1.5; margin: 0;">${escapeHtml(args.failureSummary)}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 12px;">
        <tr>
          <td style="padding: 16px; font-size: 14px; color: #4b5563; line-height: 1.9;">
            <strong style="color: #111827;">Business:</strong> ${escapeHtml(args.businessName)}<br />
            <strong style="color: #111827;">Package:</strong> ${escapeHtml(args.tierLabel)}<br />
            <strong style="color: #111827;">Week:</strong> ${escapeHtml(args.weekLabel)}<br />
            <strong style="color: #111827;">Amount paid:</strong> ${escapeHtml(amount)}<br />
            <strong style="color: #111827;">Buyer:</strong> ${escapeHtml(args.contactName)} &lt;${escapeHtml(args.buyerEmail)}&gt;<br />
            <strong style="color: #111827;">Detected:</strong> ${escapeHtml(when)} CT
          </td>
        </tr>
      </table>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Check the booking in admin to see its current state. If the slot is not locked or the ad rows are
        missing, the payment is in Stripe and the booking can be repaired or refunded from there.
      </p>
      ${button("#b91c1c", args.adminUrl, "Open Booking in Admin")}
    `);

    const result = await client.sendEmail({
      to,
      subject: `ALERT: Sponsor booking needs attention - ${args.businessName} (${args.weekLabel})`,
      htmlBody: html,
    });
    if (!result.success) {
      console.error("ALERT UNSENDABLE via email:", result.error, args.failureSummary);
    }
    return result.success;
  } catch (err) {
    console.error("Failed to send fulfillment alert:", err, args.failureSummary);
    return false;
  }
}

export async function sendWeekResults(args: {
  to: string; contactName: string; businessName: string; tierLabel: string;
  weekLabel: string; sends: number; opens: number; clicks: number; rebookUrl: string;
}): Promise<void> {
  try {
    const { workspace, client } = await loadClient();
    if (!client) return;
    const a = accent(workspace);

    const html = shell(`
      <h2 style="color: #111827; margin: 0 0 12px;">How your sponsorship did</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Hi ${escapeHtml(args.contactName)}, your ${escapeHtml(args.tierLabel)} week (${escapeHtml(args.weekLabel)}) has wrapped up.
        Here is how ${escapeHtml(args.businessName)} did with ${escapeHtml(workspace.name)} readers:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 12px;">
        <tr>
          ${statCell("Emails sent", args.sends.toLocaleString())}
          ${statCell("Opened", args.opens.toLocaleString())}
          ${statCell("Ad clicks", args.clicks.toLocaleString())}
        </tr>
      </table>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Your ad was clicked ${args.clicks.toLocaleString()} times by local readers who chose to learn more about your business.
      </p>
      ${button(a, args.rebookUrl, "Book Another Week")}
      <p style="color: #9ca3af; font-size: 12px;">Weeks sell out, so grab your next one early.</p>
    `);

    await client.sendEmail({
      to: args.to,
      subject: `How your ${args.businessName} sponsorship did`,
      htmlBody: html,
    });
  } catch (err) {
    console.error("Failed to send week results email:", err);
  }
}

export async function sendRenewalNudge(args: {
  to: string; contactName: string; businessName: string; tierLabel: string;
  weekLabel: string; clicks: number; rebookUrl: string;
}): Promise<void> {
  try {
    const { workspace, client } = await loadClient();
    if (!client) return;
    const a = accent(workspace);

    const html = shell(`
      <h2 style="color: #111827; margin: 0 0 12px;">Want to run it again?</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Hi ${escapeHtml(args.contactName)}, your ${escapeHtml(args.tierLabel)} week (${escapeHtml(args.weekLabel)}) sent
        ${args.clicks.toLocaleString()} readers to ${escapeHtml(args.businessName)}. Want to keep that going?
      </p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Your business details and logo are saved, so rebooking takes about a minute. Just pick a new week and pay.
      </p>
      ${button(a, args.rebookUrl, "Rebook My Sponsorship")}
      <p style="color: #9ca3af; font-size: 12px;">Thanks for supporting ${escapeHtml(workspace.name)}.</p>
    `);

    await client.sendEmail({
      to: args.to,
      subject: `Want to run it again, ${args.contactName}?`,
      htmlBody: html,
    });
  } catch (err) {
    console.error("Failed to send renewal nudge email:", err);
  }
}

export async function sendCommunityBoardConfirmation(args: {
  to: string; contactName: string; businessName: string; portalUrl: string;
}): Promise<void> {
  try {
    const { workspace, client } = await loadClient();
    if (!client) return;
    const a = accent(workspace);

    const html = shell(`
      <h2 style="color: #111827; margin: 0 0 12px;">You're on the Community Board</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Hi ${escapeHtml(args.contactName)}, ${escapeHtml(args.businessName)} is now live on the
        ${escapeHtml(workspace.name)} Community Board. Your listing will rotate at the bottom of the newsletter,
        in front of local readers every morning.
      </p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Use your sponsor portal any time to update your listing.
      </p>
      ${button(a, args.portalUrl, "Open My Sponsor Portal")}
      <p style="color: #9ca3af; font-size: 12px;">
        When you are ready for top-of-email placement, check out the paid weekly packages on the sponsor page.
      </p>
    `);

    await client.sendEmail({
      to: args.to,
      subject: `Your Community Board listing is live: ${args.businessName}`,
      htmlBody: html,
    });
  } catch (err) {
    console.error("Failed to send community board confirmation email:", err);
  }
}

export async function sendCommunityBoardUpgradeNudge(args: {
  to: string; contactName: string; businessName: string; appearances: number; upgradeUrl: string;
}): Promise<void> {
  try {
    const { workspace, client } = await loadClient();
    if (!client) return;
    const a = accent(workspace);
    const approx = `about ${args.appearances.toLocaleString()}`;

    const html = shell(`
      <h2 style="color: #111827; margin: 0 0 12px;">Your listing is getting seen</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Hi ${escapeHtml(args.contactName)}, quick update: ${escapeHtml(args.businessName)} has appeared in the
        newsletter roughly ${escapeHtml(approx)} times so far. Local readers are seeing your name every week.
      </p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Want more than a bottom-of-the-email mention? The weekly paid packages put your business at the top of
        the email with your logo and a few sentences about what you do, all week long.
      </p>
      ${button(a, args.upgradeUrl, "See Paid Packages")}
      <p style="color: #9ca3af; font-size: 12px;">Your free listing stays live either way.</p>
    `);

    await client.sendEmail({
      to: args.to,
      subject: `Your ${args.businessName} listing is getting seen`,
      htmlBody: html,
    });
  } catch (err) {
    console.error("Failed to send community board upgrade nudge email:", err);
  }
}
