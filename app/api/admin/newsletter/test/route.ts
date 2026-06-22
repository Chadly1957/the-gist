import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient } from "@/lib/email";
import { renderTemplate, Block, SpotlightItem, PresentingSponsorItem, InArticleAdItem } from "@/lib/template-renderer";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { testEmail, subject, templateId, articleIds, blurb, newsletterDate } = await req.json();

  if (!testEmail) return NextResponse.json({ error: "Test email address is required." }, { status: 400 });
  if (!subject || !templateId || !articleIds?.length) {
    return NextResponse.json(
      { error: "Subject, template, and at least one article are required." },
      { status: 400 }
    );
  }

  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds } },
    orderBy: { publishedAt: "desc" },
  });

  let blocks: Block[] = JSON.parse(template.blocks);

  if (blurb) {
    blocks = blocks.map((b, i) =>
      b.type === "text" && i === blocks.findIndex((x) => x.type === "text")
        ? { ...b, content: { ...b.content, html: `${b.content.html}<p>${blurb}</p>` } }
        : b
    ) as Block[];
  }

  const date = newsletterDate || new Date().toISOString().split("T")[0];

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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const htmlBody = renderTemplate(
    blocks,
    articles.map((a) => ({ ...a, publishedAt: a.publishedAt })),
    { spotlights, presentingSponsor, inArticleAds }
  ).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, `${appUrl}/unsubscribe`);

  const emailClient = getEmailClient(allSettings);
  if (!emailClient) {
    return NextResponse.json(
      { error: "SMTP is not configured. Add your credentials in Settings." },
      { status: 503 }
    );
  }

  const result = await emailClient.sendEmail({ to: testEmail, subject: `[TEST] ${subject}`, htmlBody });
  if (!result.success) {
    return NextResponse.json({ error: `Send failed: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ message: `Test email sent to ${testEmail}` });
}
