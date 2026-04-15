import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.source.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, url } = await req.json();
  if (!name || !url) {
    return NextResponse.json({ error: "Name and URL required." }, { status: 400 });
  }

  try {
    new URL(url); // validate URL
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  try {
    const source = await prisma.source.create({ data: { name, url } });
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Source with this URL already exists." },
      { status: 409 }
    );
  }
}
