import { getWorkspaceUrl } from "@/lib/workspace";
import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient, htmlToText } from "@/lib/email";
import { renderTemplate, Block, SpotlightItem, PresentingSponsorItem, InArticleAdItem, EventItem } from "@/lib/template-renderer";
import { fetchWeatherSnapshot, WeatherSnapshot } from "@/lib/weather";
import { blurbToHtml } from "@/lib/url";

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
        ? { ...b, content: { ...b.content, html: `${b.content.html}${blurbToHtml(blurb)}` } }
        : b
    ) as Block[];
  }

  const date = newsletterDate || new Date().toISOString().split("T")[0];

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
  const events: EventItem[] = await (prisma as any).event.findMany({
    where: { status: "approved", eventDate: { gte: date, lte: dateEndStr } },
    orderBy: { eventDate: "asc" },
  });

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

  const appUrl = await getWorkspaceUrl();

  // Fetch the weather snapshot at send time (if the template has a weather block).
  // Wrapped in try/catch so a weather API hiccup never blocks the test send.
  const weatherBlock = blocks.find((b) => b.type === "weather");
  let weatherData: WeatherSnapshot | undefined;
  if (weatherBlock) {
    try {
      const ws = await getWorkspace();
      const blockLat = parseFloat(String(weatherBlock.content.latitude || ""));
      const blockLon = parseFloat(String(weatherBlock.content.longitude || ""));
      // Block-level coordinates override the workspace location when set
      const lat = !Number.isNaN(blockLat) ? blockLat : ws.latitude ?? 39.8403;
      const lon = !Number.isNaN(blockLon) ? blockLon : ws.longitude ?? -88.9454;
      const locationName = String(weatherBlock.content.locationName || "") || ws.area || "Decatur";
      const timezone = ws.timezone || "America/Chicago";
      weatherData = await fetchWeatherSnapshot(lat, lon, locationName, timezone);
    } catch {
      // Weather unavailable — the block renders a graceful placeholder
    }
  }

  const htmlBody = renderTemplate(
    blocks,
    articles.map((a) => ({ ...a, publishedAt: a.publishedAt })),
    { spotlights, presentingSponsor, inArticleAds },
    undefined,
    events,
    undefined,
    undefined,
    weatherData
  )
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, `${appUrl}/unsubscribe`)
    .replace(/\{\{PROFILE_URL\}\}/g, `${appUrl}/profile?r=preview`)
    .replace(/\{\{APP_URL\}\}/g, appUrl)
    .replace(/REFCODEPLACEHOLDER/g, "preview");

  const emailClient = await getEmailClient(allSettings);
  if (!emailClient) {
    return NextResponse.json(
      { error: "SMTP is not configured. Add your credentials in Settings." },
      { status: 503 }
    );
  }

  const unsubUrl = `${appUrl}/unsubscribe`;
  const result = await emailClient.sendEmail({
    to: testEmail,
    subject: `[TEST] ${subject}`,
    htmlBody,
    textBody: htmlToText(htmlBody),
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (!result.success) {
    return NextResponse.json({ error: `Send failed: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ message: `Test email sent to ${testEmail}` });
}
