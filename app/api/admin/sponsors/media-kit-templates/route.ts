import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { workspaceUnique } from "@/lib/workspace";
import { getMediaKitTemplates } from "@/lib/media-kit";
import { isMediaKitKind, isValidZone } from "@/lib/media-kit-shared";

export const dynamic = "force-dynamic";

// Media Kit templates for the current workspace (Admin > Sponsors >
// Profiles): one flyer template and one social template, each a
// background image plus the QR and logo zones drawn on it in the zone
// editor. Reads and writes are workspace-scoped by the prisma client,
// same as every other sponsors route.

// GET: both templates (or null per kind) for the templates card.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await getMediaKitTemplates();
  return NextResponse.json({ templates });
}

// PUT: upsert one kind's image + zones.
export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { kind?: unknown; imageUrl?: unknown; qrZone?: unknown; logoZone?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!isMediaKitKind(payload.kind)) {
    return NextResponse.json({ error: "kind must be \"flyer\" or \"social\"." }, { status: 400 });
  }
  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : "";
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json({ error: "A template image URL is required. Upload an image first." }, { status: 400 });
  }
  if (!isValidZone(payload.qrZone)) {
    return NextResponse.json({ error: "The QR zone is missing or out of bounds." }, { status: 400 });
  }
  if (!isValidZone(payload.logoZone)) {
    return NextResponse.json({ error: "The logo zone is missing or out of bounds." }, { status: 400 });
  }

  const row = await prisma.mediaKitTemplate.upsert({
    where: await workspaceUnique("kind", payload.kind),
    create: { kind: payload.kind, imageUrl, qrZone: payload.qrZone, logoZone: payload.logoZone },
    update: { imageUrl, qrZone: payload.qrZone, logoZone: payload.logoZone },
  });

  return NextResponse.json({
    template: {
      kind: payload.kind,
      imageUrl: row.imageUrl,
      qrZone: row.qrZone,
      logoZone: row.logoZone,
      updatedAt: row.updatedAt,
    },
  });
}
