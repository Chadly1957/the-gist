import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { renderTemplate, Block, SpotlightItem, PresentingSponsorItem, InArticleAdItem, EventItem, PollData } from "@/lib/template-renderer";
import { getEmailClient, htmlToText } from "@/lib/email";
import { signTrackingUrl } from "@/lib/tracking";
import { blurbToHtml } from "@/lib/url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function generateRefCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

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
        ? { ...b, content: { ...b.content, html: `${b.content.html}${blurbToHtml(blurb)}` } }
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

  const dateEnd = new Date(date + "T00:00:00");
  dateEnd.setDate(dateEnd.getDate() + 30);
  const dateEndStr = dateEnd.toISOString().split("T")[0];

  const [rawSpotlights, dateBookings] = await Promise.all([
    prisma.spotlightListing.findMany({
      where: { status: "approved" },
      orderBy: [{ lastShownAt: { sort: "asc", nulls: "first" } }, { shownCount: "asc" }],
      take: spotlightCount,
    }),
    prisma.adBooking.findMany({
      where: { date, status: "approved" },
      include: { sponsor: { select: { businessName: true } } },
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEvents: EventItem[] = await (prisma as any).event.findMany({
    where: { status: "approved", eventDate: { gte: date, lte: dateEndStr } },
    orderBy: { eventDate: "asc" },
  });
  const events: EventItem[] = rawEvents;

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

  const emailClient = getEmailClient(allSettings);
  const activeSubscribers = emailClient
    ? await prisma.subscriber.findMany({ where: { active: true }, select: { id: true, email: true } })
    : [];
  const willSend = !!emailClient && activeSubscribers.length > 0;

  // Create Poll + PollOption DB records for any poll blocks.
  // Wrapped in try/catch so a missing Poll table (pre-migration) never blocks sending.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const pollBlocks = blocks.filter((b) => b.type === "poll");
  const pollsMap = new Map<string, PollData>();
  if (pollBlocks.length > 0 && db.poll) {
    for (const b of pollBlocks) {
      try {
        const blockId = String(b.content.blockId || b.id);
        const question = String(b.content.question || "What do you think?");
        const rawOptions = [b.content.option0, b.content.option1, b.content.option2, b.content.option3]
          .map(String)
          .filter(Boolean);
        if (rawOptions.length < 2) continue;
        const poll = await db.poll.create({ data: { question } });
        const options = await Promise.all(
          rawOptions.map((label: string, i: number) =>
            db.pollOption.create({ data: { pollId: poll.id, label, sortOrder: i } })
          )
        );
        pollsMap.set(blockId, { pollId: poll.id, appUrl, options: options.map((o: { id: string; label: string }) => ({ id: o.id, label: o.label })) });
      } catch {
        // Poll tables not yet created — skip poll, newsletter still sends
      }
    }
  }

  // Render HTML once. Open/click tracking links embed a recipient-id
  // placeholder that gets swapped in per-recipient below, so the template
  // only needs to be rendered a single time regardless of list size.
  const htmlBody = renderTemplate(
    blocks,
    articles.map((a) => ({ ...a, publishedAt: a.publishedAt })),
    { spotlights, presentingSponsor, inArticleAds },
    willSend ? { baseUrl: appUrl, sign: signTrackingUrl } : undefined,
    events,
    pollsMap
  )
    .replace(
      /\{\{UNSUBSCRIBE_URL\}\}/g,
      willSend
        ? `${appUrl}/unsubscribe?r=RIDPLACEHOLDER&email=EMAILPLACEHOLDER`
        : `${appUrl}/unsubscribe`
    )
    .replace(/\{\{PROFILE_URL\}\}/g, willSend ? `${appUrl}/profile?r=RIDPLACEHOLDER` : `${appUrl}/profile`)
    .replace(/\{\{APP_URL\}\}/g, appUrl);

  // Build per-subscriber referral code map if the template has a referral block
  const hasReferral = htmlBody.includes("REFCODEPLACEHOLDER");
  const refCodeMap = new Map<string, string>(); // subscriberId -> code
  if (hasReferral && activeSubscribers.length > 0) {
    const subscriberIds = activeSubscribers.map((s) => s.id);
    const existingCodes = await db.referralCode.findMany({
      where: { subscriberId: { in: subscriberIds } },
    });
    for (const rc of existingCodes) {
      refCodeMap.set(rc.subscriberId, rc.code);
    }
    const missingSubscribers = activeSubscribers.filter((s) => !refCodeMap.has(s.id));
    for (const sub of missingSubscribers) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const code = generateRefCode();
          await db.referralCode.create({ data: { subscriberId: sub.id, code } });
          refCodeMap.set(sub.id, code);
          break;
        } catch {
          // unique constraint violation — retry with new code
        }
      }
    }
  }

  // Clean snapshot for public archive: no tracking tokens, no personalization
  const htmlSnapshot = renderTemplate(
    blocks,
    articles.map((a) => ({ ...a, publishedAt: a.publishedAt })),
    { spotlights, presentingSponsor, inArticleAds },
    undefined,
    events,
    pollsMap
  )
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, `${appUrl}/unsubscribe`)
    .replace(/\{\{PROFILE_URL\}\}/g, `${appUrl}/profile`)
    .replace(/\{\{APP_URL\}\}/g, appUrl);

  let recipientCount = 0;
  const status = emailClient ? "sent" : "draft";

  const newsletterSend = await prisma.newsletterSend.create({
    data: { subject, htmlBody, htmlSnapshot, recipientCount: 0, status },
  });

  // Link polls to this send
  if (pollsMap.size > 0 && db.poll) {
    try {
      const pollIds = Array.from(pollsMap.values()).map((p) => p.pollId);
      await db.poll.updateMany({ where: { id: { in: pollIds } }, data: { newsletterSendId: newsletterSend.id } });
    } catch {
      // Non-fatal if poll tables don't exist yet
    }
  }

  if (willSend) {
    const recipients = await Promise.all(
      activeSubscribers.map((s) =>
        prisma.newsletterRecipient.create({
          data: { newsletterSendId: newsletterSend.id, subscriberId: s.id, email: s.email },
        })
      )
    );

    const personalized = recipients.map((r) => {
      const sub = activeSubscribers.find((s) => s.email === r.email);
      const refCode = (sub && refCodeMap.get(sub.id)) || "nocode";
      const personalizedHtml = htmlBody
        .replaceAll("RIDPLACEHOLDER", r.id)
        .replaceAll("EMAILPLACEHOLDER", encodeURIComponent(r.email))
        .replaceAll("REFCODEPLACEHOLDER", refCode);
      const unsubUrl = `${appUrl}/unsubscribe?r=${r.id}&email=${encodeURIComponent(r.email)}`;
      return {
        to: r.email,
        subject,
        htmlBody: personalizedHtml,
        textBody: htmlToText(personalizedHtml),
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const result = await emailClient!.sendBatch(personalized);
    if (!result.success) {
      await prisma.newsletterSend.update({ where: { id: newsletterSend.id }, data: { status: "failed" } });
      return NextResponse.json(
        { error: `Send failed: ${result.error}` },
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

  // Record spotlight appearances and update rotation counters
  await Promise.all([
    ...rawSpotlights.map((s) =>
      prisma.spotlightListing.update({
        where: { id: s.id },
        data: { lastShownAt: new Date(), shownCount: { increment: 1 } },
      })
    ),
    ...rawSpotlights.map((s) =>
      prisma.newsletterSendSpotlight.create({
        data: { newsletterSendId: newsletterSend.id, spotlightId: s.id },
      })
    ),
  ]);

  if (status === "draft") {
    return NextResponse.json({
      message:
        "Newsletter saved as draft. Configure SMTP in Settings to send to your list.",
    });
  }

  return NextResponse.json({
    message: `Newsletter sent to ${recipientCount.toLocaleString()} subscribers!`,
  });
}
