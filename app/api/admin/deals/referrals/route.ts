import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Referral-wallet slots: Chad pastes his Rakuten/Ibotta links once; they render
// in the book and the weekly digest. No code changes needed later.
const KEYS = ["deals_referral_rakuten", "deals_referral_ibotta", "deals_referral_note"] as const;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const rows = await prisma.setting.findMany({
    where: { workspaceId: workspace.id, key: { in: [...KEYS] } },
  });
  const out: Record<string, string> = {};
  for (const k of KEYS) out[k] = rows.find((r) => r.key === k)?.value || "";
  return NextResponse.json({ referrals: out });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const body = await req.json();
  for (const k of KEYS) {
    const v = String(body[k] ?? "").trim().slice(0, 500);
    await basePrisma.setting.upsert({
      where: { workspaceId_key: { workspaceId: workspace.id, key: k } },
      update: { value: v },
      create: { workspaceId: workspace.id, key: k, value: v },
    });
  }
  return NextResponse.json({ ok: true });
}
