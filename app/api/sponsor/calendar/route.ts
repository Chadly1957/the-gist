import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const bookings = await prisma.adBooking.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: { in: ["pending_review", "approved"] },
    },
    select: { date: true, type: true },
  });

  const availability: Record<string, { inArticle: number; presenting: number }> = {};
  for (const b of bookings) {
    if (!availability[b.date]) availability[b.date] = { inArticle: 0, presenting: 0 };
    if (b.type === "in_article") availability[b.date].inArticle++;
    if (b.type === "presenting") availability[b.date].presenting++;
  }

  return NextResponse.json({ availability });
}
