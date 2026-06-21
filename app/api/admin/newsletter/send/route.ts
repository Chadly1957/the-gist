import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getResendClient } from "@/lib/resend";
import { renderTemplate, Block, SpotlightItem, PresentingSponsorItem, InArticleAdItem } from "@/lib/template-renderer";
import { signTrackingUrl } from "@/lib/tracking";

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

  // Send via Resend
  const resend = await getResendClient(allSettings);
  const activeSubscribers = resend
    ? await prisma.subscriber.findMany({ where: { active: true }, select: { id: true, email: true } })
    : [];
  const willSend = !!resend && activeSubscribers.length > 0;

  // Render HTML once. Open/click tracking links embed a recipient-id
  // placeholder that gets swapped in per-recipient below, so the template
  // only needs to be rendered a single time regardless of list size.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const htmlBody = renderTemplate(
    blocks,
    articles.map((a) => ({ ...a, publishedAt: a.publishedAt })),
    { spotlights, presentingSponsor, inArticleAds },
    willSend ? { baseUrl: appUrl, sign: signTrackingUrl } : undefined
  ).replace(
    /\{\{UNSUBSCRIBE_URL\}\}/g,
    willSend
      ? `${appUrl}/unsubscribe?r=RIDPLACEHOLDER&email=EMAILPLACEHOLDER`
      : `${appUrl}/unsubscribe`
  );

  // Clean snapshot for public archive: no tracking tokens, no personalization
  const htmlSnapshot = renderTemplate(
    blocks,
    articles.map((a) => ({ ...a, publishedAt: a.publishedAt })),
    { spotlights, presentingSponsor, inArticleAds }
  ).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, `${appUrl}/unsubscribe`);

  let recipientCount = 0;
  const status = resend ? "sent" : "draft";

  const newsletterSend = await prisma.newsletterSend.create({
    data: { subject, htmlBody, htmlSnapshot, recipientCount: 0, status },
  });

  if (willSend) {
    const recipients = await Promise.all(
      activeSubscribers.map((s) =>
        prisma.newsletterRecipient.create({
          data: { newsletterSendId: newsletterSend.id, subscriberId: s.id, email: s.email },
        })
      )
    );

    const personalized = recipients.map((r) => ({
      to: r.email,
      subject,
      htmlBody: htmlBody
        .replaceAll("RIDPLACEHOLDER", r.id)
        .replaceAll("EMAILPLACEHOLDER", encodeURIComponent(r.email)),
    }));

    const result = await resend.sendBatch(personalized);
    if (!result.success) {
      await prisma.newsletterSend.update({ where: { id: newsletterSend.id }, data: { status: "failed" } });
      return NextResponse.json(
        { error: `Resend error: ${result.error}` },
        { status: 502 }
      );
    }

    recipientCount = recipients.length;
    await Promise.all([
      prisma.newsletterSend.update({ where: { id: newsletterSend.id }, data: { recipientCount } }),
      ...(result.data ?? []).map((d, i) =>
        d?.id
          ? prisma.newsletterRecipient.update({ where: { id: recipients[i].id }, data: { resendEmailId: d.id } })
          : Promise.resolve()
      ),
    ]);
  }

  // Update spotlight rotation counters
  await Promise.all(
    rawSpotlights.map((s) =>
      prisma.spotlightListing.update({
        where: { id: s.id },
        data: { lastShownAt: new Date(), shownCount: { increment: 1 } },
      })
    )
  );

  if (status === "draft") {
    return NextResponse.json({
      message:
        "Newsletter saved as draft. Configure Resend API in Settings to send to your list.",
    });
  }

  return NextResponse.json({
    message: `Newsletter sent to ${recipientCount.toLocaleString()} subscribers!`,
  });
}
