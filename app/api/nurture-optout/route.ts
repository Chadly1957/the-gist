import { basePrisma } from "@/lib/db-base";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// "Stop deal reminders" link from the Deals nurture emails. Opts the
// subscriber out of the deal-reminder sequence only — the newsletter itself
// stays subscribed. Returns a plain confirmation page.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("wid") || "";
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  if (workspaceId && email.includes("@")) {
    try {
      await basePrisma.subscriber.update({
        where: { workspaceId_email: { workspaceId, email } },
        data: { dealsNurtureOptOut: true },
      });
    } catch {
      // Return success regardless — don't leak whether an email exists.
    }
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Deal reminders off</title></head>
    <body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 64px 24px; text-align: center;">
      <h1 style="font-size: 22px; color: #111827;">You&apos;re all set.</h1>
      <p style="color: #6b7280; font-size: 15px; line-height: 1.6;">No more deal reminders coming your way. You&apos;ll still get the free daily newsletter.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
