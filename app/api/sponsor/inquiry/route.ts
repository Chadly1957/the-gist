import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { prisma } from "@/lib/db";
import { getWorkspaceUrl, withWorkspace } from "@/lib/workspace";
import { getEmailClient } from "@/lib/email";
import { escapeHtml } from "@/lib/html";
import { sendSponsorPortalLinksEmail } from "@/lib/sponsor-email";
import { CAMPAIGN_BUNDLE_SLUGS } from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Lead form on the sponsorship landing page. Every interest creates (or
// finds) the business's sponsor profile in the chosen market(s) and emails
// their portal link(s), so a lead is never just a message in an inbox:
// - free:     they finish their directory listing in the portal.
// - campaign: profile captured, then the client routes them into booking.
// - partner:  profile captured + the inquiry is emailed to Chad to work.
const OWNER_EMAIL = "chad@thegistdecatur.com";
const INTEREST_LABELS: Record<string, string> = {
  free: "Free business listing",
  campaign: "7-Issue Featured Campaign",
  partner: "Presenting Partnership",
};

export async function POST(req: NextRequest) {
  const { interest, businessName, contactName, email, market, goal } = await req.json();

  if (!INTEREST_LABELS[interest]) {
    return NextResponse.json({ error: "Pick what you'd like to do." }, { status: 400 });
  }
  const trimmedBusiness = businessName?.trim();
  const trimmedContact = contactName?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  if (!trimmedBusiness || !trimmedContact || !normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Business name, your name, and a valid email are required." }, { status: 400 });
  }

  const targetSlugs =
    market === "both"
      ? [...CAMPAIGN_BUNDLE_SLUGS]
      : CAMPAIGN_BUNDLE_SLUGS.includes(market)
        ? [market as string]
        : null;
  if (!targetSlugs) {
    return NextResponse.json({ error: "Pick where you serve." }, { status: 400 });
  }

  const workspaces = await basePrisma.workspace.findMany({ where: { slug: { in: targetSlugs } } });
  if (workspaces.length !== targetSlugs.length) {
    return NextResponse.json({ error: "That market is not available right now." }, { status: 503 });
  }
  const ordered = targetSlugs.map((slug) => workspaces.find((w) => w.slug === slug)!);

  // Find-or-create the profile in each target market and collect portal links.
  const links: { businessName: string; portalUrl: string }[] = [];
  for (const ws of ordered) {
    let profile = await basePrisma.sponsorProfile.findFirst({
      where: {
        workspaceId: ws.id,
        email: normalizedEmail,
        businessName: { equals: trimmedBusiness, mode: "insensitive" },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, magicToken: true },
    });
    if (!profile) {
      profile = await basePrisma.sponsorProfile.create({
        data: {
          workspaceId: ws.id,
          businessName: trimmedBusiness,
          contactName: trimmedContact,
          email: normalizedEmail,
        },
        select: { id: true, magicToken: true },
      });
    }
    const appUrl = await withWorkspace(ws, () => getWorkspaceUrl());
    links.push({ businessName: trimmedBusiness, portalUrl: `${appUrl}/sponsor/portal?token=${profile.magicToken}` });
  }

  // One email with every portal link, sent under the first market's context
  // so the branding and sender match that publication.
  await withWorkspace(ordered[0], async () => {
    await sendSponsorPortalLinksEmail(normalizedEmail, trimmedContact, links);
  });

  if (interest === "partner") {
    try {
      const rows = await prisma.setting.findMany();
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const client = await getEmailClient(settings);
      if (client) {
        const marketLabel = ordered.map((w) => w.name).join(" + ");
        await client.sendEmail({
          to: OWNER_EMAIL,
          subject: `Partnership inquiry: ${trimmedBusiness}`,
          htmlBody: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
              <h2 style="margin: 0 0 12px; color: #111827;">New Presenting Partnership inquiry</h2>
              <p style="color: #374151; font-size: 14px; line-height: 1.6;">
                <strong>Business:</strong> ${escapeHtml(trimmedBusiness)}<br/>
                <strong>Contact:</strong> ${escapeHtml(trimmedContact)} (${escapeHtml(normalizedEmail)})<br/>
                <strong>Market:</strong> ${escapeHtml(marketLabel)}<br/>
                <strong>Goal:</strong> ${escapeHtml(goal?.trim() || "Not provided")}
              </p>
              <p style="color: #6b7280; font-size: 13px;">Their sponsor profile is created and they have been emailed their portal link. Reply to this lead by email, then set up the partnership in Admin → Partnerships when they say yes.</p>
            </div>`,
        });
      }
    } catch (err) {
      console.error("Failed to send partnership inquiry email:", err);
    }
  }

  // Campaign buyers go straight into the booking flow for their market.
  let redirect: string | null = null;
  if (interest === "campaign") {
    if (market === "both") {
      redirect = "/sponsor/apply?market=both";
    } else if (ordered[0]) {
      const host = req.headers.get("host")?.split(":")[0].toLowerCase().replace(/^www\./, "");
      const targetUrl = await withWorkspace(ordered[0], () => getWorkspaceUrl());
      redirect = ordered[0].domain && host === ordered[0].domain.replace(/^www\./, "") ? "/sponsor/apply" : `${targetUrl}/sponsor/apply`;
    }
  }

  return NextResponse.json({ ok: true, redirect });
}
