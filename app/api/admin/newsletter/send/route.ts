import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getUnosendClient } from "@/lib/unosend";
import { renderTemplate, Block, SpotlightItem, PresentingSponsorItem, InArticleAdItem } from "@/lib/template-renderer";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, templateId, articleIds, blurb, newsletterDate } = await req.json();

  if (!subject || !templateId || !articleIds?.length) {
    return NextResponse.json(
      { error: "Subject, template, and at least one article are required." },
      { status: 400 }
    );
  }

  // Fetch template
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  // Fetch selected articles
  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds } },
    orderBy: { publishedAt: "desc" },
  });

  let blocks: Block[] = JSON.parse(template.blocks);

  // Inject optional blurb into first text block
  if (blurb) {
    blocks = blocks.map((b, i) =>
      b.type === "text" && i === blocks.findIndex((x) => x.type === "text")
        ? { ...b, content: { ...b.content, html: `${b.content.html}<p>${blurb}</p>` } }
        : b
    ) as Block[];
  }

  // Fetch sponsor data for this newsletter date
  const date = newsletterDate || new Date().toISOString().split("T")[0];

  // Load settings first so we can use configured limits
  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const spotlightCount = Math.max(1, parseInt(allSettings.spotlight_count || "5") || 5);
  const inArticleCount = Math.max(1, parseInt(allSettings.in_article_count || "2") || 2);

  const [rawSpotlights, dateBookings] = await Promise.all([
    prisma.spotlightListing.findMany({
      where: { status: "approved" },
      orderBy: [{ lastShownAt: "asc" }, { shownCount: "asc" }],
      take: spotlightCount,
    }),
    prisma.adBooking.findMany({
      where: { date, status: "approved" },
      include: { sponsor: { select: { businessName: true } } },
    }),
  ]);

  const spotlights: SpotlightItem[] = rawSpotlights.map((s) => ({
    businessName: s.businessName,
    logoUrl: s.logoUrl,
    description: s.description,
    ctaLabel: s.ctaLabel,
    ctaUrl: s.ctaUrl,
  }));

  const presentingRaw = dateBookings.find((b) => b.type === "presenting");
  const presentingSponsor: PresentingSponsorItem | null = presentingRaw
    ? {
        businessName: presentingRaw.sponsor.businessName,
        headline: presentingRaw.headline,
        body: presentingRaw.body,
        ctaUrl: presentingRaw.ctaUrl,
        ctaLabel: presentingRaw.ctaLabel,
        imageUrl: presentingRaw.imageUrl,
        presentingBlurb: presentingRaw.presentingBlurb,
      }
    : null;

  const inArticleAds: InArticleAdItem[] = dateBookings
    .filter((b) => b.type === "in_article")
    .slice(0, inArticleCount)
    .map((b) => ({
      businessName: b.sponsor.businessName,
      headline: b.headline,
      body: b.body,
      ctaUrl: b.ctaUrl,
      ctaLabel: b.ctaLabel,
      imageUrl: b.imageUrl,
    }));

  // Render HTML and substitute unsubscribe URL
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const unsubscribeUrl = `${appUrl}/unsubscribe`;
  const htmlBody = renderTemplate(
    blocks,
    articles.map((a) => ({ ...a, publishedAt: a.publishedAt })),
    { spotlights, presentingSponsor, inArticleAds }
  ).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);

  // Send via Unosend
  const unosend = await getUnosendClient(allSettings);

  let recipientCount = 0;
  let status = "sent";

  if (!unosend) {
    // Save as draft if Unosend not configured
    status = "draft";
  } else {
    const activeSubscribers = await prisma.subscriber.findMany({
      where: { active: true },
      select: { email: true },
    });

    if (activeSubscribers.length > 0) {
      const result = await unosend.sendBatch(
        activeSubscribers.map((s) => ({ to: s.email, subject, htmlBody }))
      );
      if (!result.success) {
        return NextResponse.json(
          { error: `Unosend error: ${result.error}` },
          { status: 502 }
        );
      }
    }

    recipientCount = activeSubscribers.length;
  }

  // Record the send and update spotlight rotation counters
  await Promise.all([
    prisma.newsletterSend.create({ data: { subject, htmlBody, recipientCount, status } }),
    ...rawSpotlights.map((s) =>
      prisma.spotlightListing.update({
        where: { id: s.id },
        data: { lastShownAt: new Date(), shownCount: { increment: 1 } },
      })
    ),
  ]);

  if (status === "draft") {
    return NextResponse.json({
      message:
        "Newsletter saved as draft. Configure Unosend API in Settings to send to your list.",
    });
  }

  return NextResponse.json({
    message: `Newsletter sent to ${recipientCount.toLocaleString()} subscribers!`,
  });
}
