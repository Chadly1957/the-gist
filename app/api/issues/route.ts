import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const issues = await prisma.newsletterSend.findMany({
    where: { status: "sent", htmlSnapshot: { not: null } },
    select: { id: true, subject: true, sentAt: true, recipientCount: true },
    orderBy: { sentAt: "desc" },
    take: 20,
  });

  return NextResponse.json(issues);
}
