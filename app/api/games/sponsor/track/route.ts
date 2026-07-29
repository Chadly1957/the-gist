import { NextRequest, NextResponse } from "next/server";
import { getPresentingSponsor, recordGameSponsorEvent, type GameName } from "@/lib/gameSponsor";

export const dynamic = "force-dynamic";

const GAMES: GameName[] = ["wordy", "match"];
const EVENT_TYPES = ["impression", "click"] as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const game = body?.game;
  const eventType = body?.eventType;

  if (!GAMES.includes(game) || !EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: "Invalid game or eventType." }, { status: 400 });
  }

  // Re-verify against today's actual presenting sponsor server-side rather
  // than trusting a client-supplied bookingId, so a stale tab can't log
  // events against a booking that's no longer today's.
  const sponsor = await getPresentingSponsor();
  if (!sponsor) return NextResponse.json({ ok: true });

  await recordGameSponsorEvent(sponsor.bookingId, game, eventType);
  return NextResponse.json({ ok: true });
}
