// Weekly buyer digest: the fresh Gist Deals Book in buyers' inboxes every week.
// Audience = active CouponBookPurchase rows that haven't opted out.
// Triggered from the admin deals page ("Send weekly digest") after publishing.

import { basePrisma } from "@/lib/db-base";
import { withWorkspace, getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { getEmailClient, htmlToText } from "@/lib/email";
import { escapeHtml } from "@/lib/html";

export interface DigestDeal {
  title: string;
  price?: string | null;
  businessName?: string | null;
  dealUrl?: string | null;
  isItemUrl: boolean;
  isTopPick: boolean;
}

export interface DigestRetailer {
  displayName: string;
  logoUrl: string | null;
  deals: DigestDeal[];
}

export interface DigestCoupon {
  businessName: string;
  title: string;
  description: string;
  terms: string;
}

export interface DigestData {
  topPicks: DigestDeal[];
  retailers: DigestRetailer[];
  coupons: DigestCoupon[];
  weekLabel: string;
}

export async function getPublishedDigestData(workspaceId: string): Promise<DigestData> {
  const retailers = await basePrisma.retailer.findMany({
    where: { workspaceId, active: true },
    orderBy: { displayName: "asc" },
    // sponsorId needed to merge in unexpired sponsor deals below
    include: {
      dealWeeks: {
        where: { workspaceId, status: "published" },
        orderBy: { weekStart: "desc" },
        take: 1,
        include: { deals: { orderBy: [{ sortOrder: "asc" }] } },
      },
    },
  });

  const now = new Date();
  const live = (d: { expiresAt: Date | null }) => !d.expiresAt || d.expiresAt > now;
  const toDigest = (d: { title: string; price: string | null; businessName: string | null; dealUrl: string | null; isItemUrl: boolean; isTopPick: boolean }): DigestDeal => ({
    title: d.title,
    price: d.price,
    businessName: d.businessName,
    dealUrl: d.dealUrl,
    isItemUrl: d.isItemUrl,
    isTopPick: d.isTopPick,
  });

  const topPicks: DigestDeal[] = [];
  const out: DigestRetailer[] = [];
  let weekLabel = "";
  for (const r of retailers) {
    const week = r.dealWeeks[0];
    let deals: DigestDeal[] = [];
    if (week) {
      if (!weekLabel) weekLabel = `Week of ${week.weekStart}`;
      deals = week.deals.filter(live).map(toDigest);
    }
    // Sponsor sections: also pull unexpired deals from older published weeks
    // (weekly/monthly cadence outlives the week they were posted in).
    if (r.sponsorId) {
      const older = await basePrisma.deal.findMany({
        where: {
          workspaceId,
          dealWeek: { retailerId: r.id, status: "published" },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          ...(week ? { NOT: { dealWeekId: week.id } } : {}),
        },
        orderBy: [{ sortOrder: "asc" }],
      });
      const seen = new Set(deals.map((d) => d.title + "|" + (d.price || "")));
      for (const d of older) {
        const key = d.title + "|" + (d.price || "");
        if (!seen.has(key)) {
          seen.add(key);
          deals.push(toDigest(d));
        }
      }
    }
    if (!deals.length) continue;
    out.push({ displayName: r.displayName, logoUrl: r.logoUrl, deals });
    for (const d of deals) if (d.isTopPick) topPicks.push(d);
  }
  const coupons = await basePrisma.coupon.findMany({
    where: { workspaceId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { businessName: true, title: true, description: true, terms: true },
  });
  return { topPicks: topPicks.slice(0, 10), retailers: out, coupons, weekLabel };
}

function dealRow(d: DigestDeal): string {
  const label = d.businessName ? `${escapeHtml(d.businessName)}: ${escapeHtml(d.title)}` : escapeHtml(d.title);
  const price = d.price ? ` <strong>${escapeHtml(d.price)}</strong>` : "";
  const link = d.dealUrl
    ? ` <a href="${escapeHtml(d.dealUrl)}" style="color: #24726f;">${d.isItemUrl ? "view&nbsp;item&nbsp;→" : "weekly&nbsp;ad&nbsp;→"}</a>`
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
      const ws = await getWorkspace();
      const headerImg = ws.dealsEmailHeaderUrl || ws.dealsLogoUrl;
      const headerHtml = ws.dealsEmailHeaderUrl
        ? `<img src="${escapeHtml(ws.dealsEmailHeaderUrl)}" alt="The Gist Deals" style="width: 100%; max-width: 560px; height: auto; display: block; border-radius: 12px; margin: 0 0 16px;" />`
        : ws.dealsLogoUrl
          ? `<img src="${escapeHtml(ws.dealsLogoUrl)}" alt="The Gist Deals" style="height: 56px; width: auto; display: block; margin: 0 0 16px;" />`
          : "";

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

      const couponsHtml = data.coupons.length
        ? `<h3 style="color: #111827; margin: 20px 0 8px; font-size: 16px;">🎟️ Local coupons</h3>
           <ul style="padding-left: 20px; margin: 0;">${data.coupons
             .map(
               (c) =>
                 `<li style="margin: 0 0 8px; font-size: 14px; line-height: 1.45; color: #1f2937;"><strong>${escapeHtml(c.businessName)}</strong>: ${escapeHtml(c.title)}${c.terms ? ` <span style="color: #6b7280; font-size: 12px;">(${escapeHtml(c.terms)})</span>` : ""}</li>`
             )
             .join("")}</ul>
           <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;"><a href="${escapeHtml(bookUrl)}" style="color: #24726f;">Open My Gist Deals Book</a> to see all your local coupons.</p>`
        : "";

      return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      ${headerHtml}
      <h2 style="color: #111827; margin: 0 0 4px;">Your Gist Deals Book — fresh deals</h2>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px;">${escapeHtml(data.weekLabel)} · As an Amazon Associate and affiliate partner we may earn from qualifying purchases.</p>
      <p style="margin: 0 0 16px;"><a href="${escapeHtml(bookUrl)}" style="background: #24726f; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Open My Gist Deals Book</a></p>
      ${topPickHtml}
      ${retailerHtml}
      ${couponsHtml}
      ${referralHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 12px;" />
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">You're getting this because you bought the Gist Deals Book. <a href="${escapeHtml(optOutUrl)}" style="color: #9ca3af;">Stop the weekly deals email</a> (you'll keep your book).</p>
    </div>`;
    }
  );
}

export interface DigestSendResult {
  sent: number;
  failed: number;
  skipped: string;
}

// Never send two digests for the same workspace inside this window unless
// explicitly forced. The Friday cron runs weekly; the window only guards
// against accidental double-triggers (double POST, endpoint + admin button
// overlapping). A failed send writes no DealDigestSend row, so genuine
// retries after failures are unaffected by the guard.
const DIGEST_IDEMPOTENCY_HOURS = 24;

export async function sendWeeklyDigest(
  workspaceId: string,
  opts?: { testEmail?: string; force?: boolean }
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
      const subject = `[TEST] Your Gist Deals Book: fresh deals for ${data.weekLabel.replace("Week of ", "")}`;
      const bookUrl = `${workspaceUrl}/coupons`;
      const html = await renderDigestHtml(workspaceId, data, bookUrl, bookUrl);
      const batch = await client.sendBatch([
        { to: opts.testEmail!, subject, htmlBody: html, textBody: htmlToText(html) },
      ]);
      const failed = batch.data?.filter((r) => !r.id).length ?? 0;
      return { sent: 1 - failed, failed, skipped: "" };
    });
  }

  // Idempotency guard: skip when this workspace already got a digest inside
  // the window (unless forced). Test sends above return before this point,
  // so they are never blocked and never count as a real send.
  if (!opts?.force) {
    const cutoff = new Date(Date.now() - DIGEST_IDEMPOTENCY_HOURS * 3600 * 1000);
    const recent = await basePrisma.dealDigestSend.findFirst({
      where: { workspaceId, sentAt: { gte: cutoff } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true, recipientCount: true },
    });
    if (recent) {
      return {
        sent: 0,
        failed: 0,
        skipped: `Digest already sent at ${recent.sentAt.toISOString()} (${recent.recipientCount} recipients).`,
      };
    }
  }

  const buyers = await basePrisma.couponBookPurchase.findMany({
    where: { workspaceId, active: true, digestOptOut: false },
    select: { email: true, magicToken: true },
  });
  // One email per buyer even if duplicate purchase rows ever exist for the
  // same address (e.g. a webhook replay after a manual comp).
  const seen = new Set<string>();
  const uniqueBuyers = buyers.filter((b) => {
    const key = b.email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!uniqueBuyers.length) {
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

      const subject = `Your Gist Deals Book: fresh deals for ${data.weekLabel.replace("Week of ", "")}`;
      const emails = await Promise.all(
        uniqueBuyers.map(async (b) => {
          const bookUrl = `${workspaceUrl}/deals?token=${b.magicToken}`;
          const optOutUrl = `${workspaceUrl}/deals/digest-optout?token=${b.magicToken}`;
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
