// Weekly buyer digest: the fresh coupon book in buyers' inboxes every week.
// Audience = active CouponBookPurchase rows that haven't opted out.
// Triggered from the admin deals page ("Send weekly digest") after publishing.

import { basePrisma } from "@/lib/db-base";
import { withWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { getEmailClient, htmlToText } from "@/lib/email";
import { escapeHtml } from "@/lib/html";

export interface DigestDeal {
  title: string;
  price?: string | null;
  businessName?: string | null;
  dealUrl?: string | null;
  isTopPick: boolean;
}

export interface DigestRetailer {
  displayName: string;
  deals: DigestDeal[];
}

export interface DigestData {
  topPicks: DigestDeal[];
  retailers: DigestRetailer[];
  weekLabel: string;
}

export async function getPublishedDigestData(workspaceId: string): Promise<DigestData> {
  const retailers = await basePrisma.retailer.findMany({
    where: { workspaceId, active: true },
    orderBy: { displayName: "asc" },
    include: {
      dealWeeks: {
        where: { workspaceId, status: "published" },
        orderBy: { weekStart: "desc" },
        take: 1,
        include: { deals: { orderBy: [{ sortOrder: "asc" }] } },
      },
    },
  });

  const topPicks: DigestDeal[] = [];
  const out: DigestRetailer[] = [];
  let weekLabel = "";
  for (const r of retailers) {
    const week = r.dealWeeks[0];
    if (!week || !week.deals.length) continue;
    if (!weekLabel) weekLabel = `Week of ${week.weekStart}`;
    const deals: DigestDeal[] = week.deals.map((d) => ({
      title: d.title,
      price: d.price,
      businessName: d.businessName,
      dealUrl: d.dealUrl,
      isTopPick: d.isTopPick,
    }));
    out.push({ displayName: r.displayName, deals });
    for (const d of deals) if (d.isTopPick) topPicks.push(d);
  }
  return { topPicks: topPicks.slice(0, 10), retailers: out, weekLabel };
}

function dealRow(d: DigestDeal): string {
  const label = d.businessName ? `${escapeHtml(d.businessName)}: ${escapeHtml(d.title)}` : escapeHtml(d.title);
  const price = d.price ? ` <strong>${escapeHtml(d.price)}</strong>` : "";
  const link = d.dealUrl
    ? ` <a href="${escapeHtml(d.dealUrl)}" style="color: #24726f;">view&nbsp;→</a>`
    : "";
  return `<li style="margin: 0 0 8px; font-size: 14px; line-height: 1.45; color: #1f2937;">${label}${price}${link}</li>`;
}

export async function renderDigestHtml(
  workspaceId: string,
  data: DigestData,
  bookUrl: string,
  optOutUrl: string
): Promise<string> {
  return await withWorkspace(
    (await basePrisma.workspace.findUnique({ where: { id: workspaceId } }))!,
    async () => {
      const settings = Object.fromEntries(
        (await basePrisma.setting.findMany({ where: { workspaceId } })).map((r) => [r.key, r.value])
      );
      const rakuten = settings["deals_referral_rakuten"]?.trim();
      const ibotta = settings["deals_referral_ibotta"]?.trim();
      const referralNote = settings["deals_referral_note"]?.trim();

      const topPickHtml = data.topPicks.length
        ? `<h3 style="color: #111827; margin: 20px 0 8px; font-size: 16px;">⭐ This week's Top 10</h3>
           <ol style="padding-left: 20px; margin: 0;">${data.topPicks.map(dealRow).join("")}</ol>`
        : "";

      const retailerHtml = data.retailers
        .map(
          (r) => `<h3 style="color: #111827; margin: 20px 0 8px; font-size: 16px;">${escapeHtml(
            r.displayName
          )}</h3>
          <ul style="padding-left: 20px; margin: 0;">${r.deals
            .filter((d) => !d.isTopPick)
            .slice(0, 15)
            .map(dealRow)
            .join("")}</ul>`
        )
        .join("");

      const referralHtml =
        rakuten || ibotta
          ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #14532d;">💰 Stack your savings</p>
          ${referralNote ? `<p style="margin: 0 0 8px; font-size: 13px; color: #4b5563;">${escapeHtml(referralNote)}</p>` : ""}
          <p style="margin: 0; font-size: 13px; color: #4b5563;">
            ${rakuten ? `<a href="${escapeHtml(rakuten)}" style="color: #24726f;">Get cash back with Rakuten</a>` : ""}
            ${rakuten && ibotta ? " · " : ""}
            ${ibotta ? `<a href="${escapeHtml(ibotta)}" style="color: #24726f;">Get the Ibotta app</a>` : ""}
          </p>
          <p style="margin: 8px 0 0; font-size: 11px; color: #9ca3af;">We may earn a referral bonus if you sign up — at no cost to you.</p>
        </div>`
          : "";

      return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #111827; margin: 0 0 4px;">Your Coupon Book — fresh deals</h2>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px;">${escapeHtml(data.weekLabel)} · As an Amazon Associate and affiliate partner we may earn from qualifying purchases.</p>
      <p style="margin: 0 0 16px;"><a href="${escapeHtml(bookUrl)}" style="background: #24726f; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Open My Coupon Book</a></p>
      ${topPickHtml}
      ${retailerHtml}
      ${referralHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 12px;" />
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">You're getting this because you bought the Gist Coupon Book. <a href="${escapeHtml(optOutUrl)}" style="color: #9ca3af;">Stop the weekly deals email</a> (you'll keep your book).</p>
    </div>`;
    }
  );
}

export interface DigestSendResult {
  sent: number;
  failed: number;
  skipped: string;
}

export async function sendWeeklyDigest(
  workspaceId: string,
  opts?: { testEmail?: string }
): Promise<DigestSendResult> {
  const data = await getPublishedDigestData(workspaceId);
  if (!data.retailers.length) {
    return { sent: 0, failed: 0, skipped: "No published deal weeks to send." };
  }

  // Test send: renders exactly what a buyer would get (minus the personal magic
  // link) to a single address. Not logged as a digest send.
  if (opts?.testEmail) {
    const ws = (await basePrisma.workspace.findUnique({ where: { id: workspaceId } }))!;
    return withWorkspace(ws, async () => {
      const workspaceUrl = await getWorkspaceUrl();
      const settings = Object.fromEntries(
        (await basePrisma.setting.findMany({ where: { workspaceId } })).map((r) => [r.key, r.value])
      );
      const client = await getEmailClient(settings);
      if (!client) throw new Error("Email is not configured for this workspace.");
      const subject = `[TEST] Your Coupon Book: fresh deals for ${data.weekLabel.replace("Week of ", "")}`;
      const bookUrl = `${workspaceUrl}/coupons`;
      const html = await renderDigestHtml(workspaceId, data, bookUrl, bookUrl);
      const batch = await client.sendBatch([
        { to: opts.testEmail!, subject, htmlBody: html, textBody: htmlToText(html) },
      ]);
      const failed = batch.data?.filter((r) => !r.id).length ?? 0;
      return { sent: 1 - failed, failed, skipped: "" };
    });
  }

  const buyers = await basePrisma.couponBookPurchase.findMany({
    where: { workspaceId, active: true, digestOptOut: false },
    select: { email: true, magicToken: true },
  });
  if (!buyers.length) {
    return { sent: 0, failed: 0, skipped: "No buyers on the list yet." };
  }

  const result = await withWorkspace(
    (await basePrisma.workspace.findUnique({ where: { id: workspaceId } }))!,
    async () => {
      const workspaceUrl = await getWorkspaceUrl();
      const settings = Object.fromEntries(
        (await basePrisma.setting.findMany({ where: { workspaceId } })).map((r) => [r.key, r.value])
      );
      const client = await getEmailClient(settings);
      if (!client) throw new Error("Email is not configured for this workspace.");

      const subject = `Your Coupon Book: fresh deals for ${data.weekLabel.replace("Week of ", "")}`;
      const emails = await Promise.all(
        buyers.map(async (b) => {
          const bookUrl = `${workspaceUrl}/coupons?token=${b.magicToken}`;
          const optOutUrl = `${workspaceUrl}/coupons/digest-optout?token=${b.magicToken}`;
          const html = await renderDigestHtml(workspaceId, data, bookUrl, optOutUrl);
          return {
            to: b.email,
            subject,
            htmlBody: html,
            textBody: htmlToText(html),
            headers: { "List-Unsubscribe": `<${optOutUrl}>` },
          };
        })
      );
      const batch = await client.sendBatch(emails);
      const failed = batch.data?.filter((r) => !r.id).length ?? 0;
      return { sent: emails.length - failed, failed, subject };
    }
  );

  await basePrisma.dealDigestSend.create({
    data: {
      workspaceId,
      subject: result.subject,
      recipientCount: result.sent,
      dealWeekIds: JSON.stringify(
        (await basePrisma.dealWeek.findMany({
          where: { workspaceId, status: "published" },
          orderBy: { weekStart: "desc" },
          take: 20,
          select: { id: true },
        })).map((w) => w.id)
      ),
    },
  });

  return { sent: result.sent, failed: result.failed, skipped: "" };
}
