"use client";

import { useEffect, useState } from "react";

interface SponsorData {
  bookingId: string;
  businessName: string;
  headline: string;
  ctaUrl: string;
  ctaLabel: string;
  imageUrl: string | null;
}

/**
 * A small, discrete sponsor strip for the top of a game page -- the same
 * presenting sponsor shown in that day's newsletter, styled closer to a
 * Community Partner listing than a loud ad banner. Renders nothing if
 * there's no presenting sponsor booked for today.
 */
export default function GamePresentingSponsor({ game }: { game: "wordy" | "match" }) {
  const [sponsor, setSponsor] = useState<SponsorData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/games/sponsor")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.sponsor) return;
        setSponsor(d.sponsor);
        fetch("/api/games/sponsor/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game, eventType: "impression" }),
        }).catch(() => {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [game]);

  if (!sponsor) return null;

  function trackClick() {
    fetch("/api/games/sponsor/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, eventType: "click" }),
    }).catch(() => {});
  }

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 flex items-center gap-3">
      {sponsor.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsor.imageUrl}
          alt=""
          className="w-9 h-9 rounded-lg object-contain border border-gray-100 bg-white shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">
          Presented by {sponsor.businessName}
        </p>
        <p className="text-xs text-gray-600 truncate">{sponsor.headline}</p>
      </div>
      <a
        href={sponsor.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackClick}
        className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors"
      >
        {sponsor.ctaLabel} →
      </a>
    </div>
  );
}
