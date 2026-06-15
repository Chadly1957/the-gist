import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getUnosendClient } from "@/lib/unosend";
import { renderTemplate, Block } from "@/lib/template-renderer";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, templateId, articleIds, blurb } = await req.json();

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

  // Render HTML and substitute unsubscribe URL
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const unsubscribeUrl = `${appUrl}/unsubscribe`;
  const htmlBody = renderTemplate(
    blocks,
    articles.map((a) => ({
      ...a,
      publishedAt: a.publishedAt,
    }))
  ).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);

  // Send via Unosend
  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const unosend = await getUnosendClient(settings);

  let recipientCount = 0;
  let status = "sent";

  if (!unosend) {
    // Save as draft if Unosend not configured
    status = "draft";
  } else {
    const result = await unosend.sendCampaign({ subject, htmlBody });
    if (!result.success) {
      return NextResponse.json(
        { error: `Unosend error: ${result.error}` },
        { status: 502 }
      );
    }
    // Get subscriber count for record
    recipientCount = await prisma.subscriber.count({ where: { active: true } });
  }

  // Record the send
  await prisma.newsletterSend.create({
    data: { subject, htmlBody, recipientCount, status },
  });

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
