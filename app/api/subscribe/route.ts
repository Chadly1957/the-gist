import { getWorkspaceUrl, getWorkspace } from "@/lib/workspace";
import { workspaceUnique } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export async function POST(req: NextRequest) {
  try {
    const { email, firstName, variant, utmSource, utmMedium, utmCampaign, referrer } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    // First-touch acquisition only: a re-subscribe never overwrites a known
    // source with a later direct visit.
    const clean = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null;
    const acquisition = {
      utmSource: clean(utmSource),
      utmMedium: clean(utmMedium),
      utmCampaign: clean(utmCampaign),
      referrer: clean(referrer),
    };

    const existing = await prisma.subscriber.findUnique({ where: await workspaceUnique("email", email) });
    if (existing?.active) {
      return NextResponse.json(
        { error: "This email is already subscribed." },
        { status: 409 }
      );
    }

    const subscriber = existing
      ? await prisma.subscriber.update({
          where: await workspaceUnique("email", email),
          data: {
            active: true,
            firstName: firstName || existing.firstName,
            utmSource: existing.utmSource ?? acquisition.utmSource,
            utmMedium: existing.utmMedium ?? acquisition.utmMedium,
            utmCampaign: existing.utmCampaign ?? acquisition.utmCampaign,
            referrer: existing.referrer ?? acquisition.referrer,
          },
        })
      : await prisma.subscriber.create({
          data: { email, firstName: firstName || null, ...acquisition },
        });

    const appUrl = await getWorkspaceUrl();
    // Log A/B test signup event if a valid variant was passed.
    if (["a", "b"].includes(variant)) {
      try {
        const ws = await getWorkspace();
        await prisma.joinTestEvent.create({
          data: { workspaceId: ws.id, variant, event: "signup" },
        });
      } catch {
        // Event logging must not break the subscription itself
      }
    }
    try {
      await sendWelcomeEmail({ id: subscriber.id, email: subscriber.email }, appUrl);
    } catch {
      // Welcome email failure must not break the subscription itself
    }

    return NextResponse.json({
      message: `You're subscribed! Welcome to ${(await getWorkspace()).name}.`,
    });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }
}
