import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Logs A/B test events for the /join page (view + signup per variant).
export async function POST(req: NextRequest) {
  try {
    const { variant, event } = await req.json();
    if (!["a", "b"].includes(variant) || !["view", "signup"].includes(event)) {
      return NextResponse.json({ error: "Invalid variant or event." }, { status: 400 });
    }
    const workspace = await getWorkspace();
    await prisma.joinTestEvent.create({
      data: { workspaceId: workspace.id, variant, event },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("JoinTestEvent error:", err);
    return NextResponse.json({ error: "Failed to log event." }, { status: 500 });
  }
}
