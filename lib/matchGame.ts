import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const MATCH_DEVICE_COOKIE = "gist_match_device";
export const MATCH_MAX_SCORE = 20000;
export const MATCH_LEADERBOARD_SIZE = 10;

/** Canonical "today" for the daily puzzle, reset at midnight America/Chicago. */
export function todayDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getDeviceId(req: NextRequest): { deviceId: string; isNew: boolean } {
  const existing = req.cookies.get(MATCH_DEVICE_COOKIE)?.value;
  if (existing) return { deviceId: existing, isNew: false };
  return { deviceId: randomUUID(), isNew: true };
}

export function setDeviceCookie(res: NextResponse, deviceId: string) {
  res.cookies.set(MATCH_DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    path: "/",
  });
}
