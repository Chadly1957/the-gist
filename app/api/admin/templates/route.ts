import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

const DEFAULT_BLOCKS = JSON.stringify([
  {
    id: "header-1",
    type: "header",
    content: {
      title: "The Gist Decatur",
      subtitle: "Your daily briefing from Decatur",
      date: "{{DATE}}",
    },
  },
  {
    id: "text-1",
    type: "text",
    content: { html: "<p>Good morning! Here's what's happening in Decatur today.</p>" },
  },
  {
    id: "articles-1",
    type: "articles",
    content: { label: "Today's Top Stories" },
  },
  { id: "divider-1", type: "divider", content: {} },
  {
    id: "footer-1",
    type: "footer",
    content: {
      text: "You're receiving this because you signed up at thegistdecatur.com",
      unsubscribeText: "Unsubscribe",
    },
  },
]);

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.template.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, blocks } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name required." }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: { name, blocks: typeof blocks === "string" && blocks ? blocks : DEFAULT_BLOCKS },
  });
  return NextResponse.json({ template }, { status: 201 });
}
