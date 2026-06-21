import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const send = await prisma.newsletterSend.findUnique({
    where: { id: params.id },
    select: { htmlSnapshot: true, status: true },
  });

  if (!send || send.status !== "sent" || !send.htmlSnapshot) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(send.htmlSnapshot, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
