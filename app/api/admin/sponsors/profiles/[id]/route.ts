import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { id: params.id } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // Cascades to their spotlight listings, ad bookings, and wordy bookings.
    await prisma.sponsorProfile.delete({ where: { id: params.id } });
  } catch (err: unknown) {
    // onDelete: Restrict on Event.sponsor — profile can't be deleted while linked to events.
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      return NextResponse.json(
        { error: "This sponsor is linked to calendar events and can't be deleted. Unlink them from those events first." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
