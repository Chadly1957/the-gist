import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const count = await prisma.subscriber.count({ where: { active: true } });
  // Round down to nearest 10 so "240+" is always honest
  const rounded = Math.floor(count / 10) * 10;
  return NextResponse.json({ count, rounded });
}
