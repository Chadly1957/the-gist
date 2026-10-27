"use client";

import Link from "@/components/workspace/WorkspaceLink";
import { BOARD_PRICE_CENTS, BOARD_RUN_DAYS } from "@/lib/board-constants";

// Offered right after an event is submitted (sponsor portal and the public
// event form alike). Accepting takes the poster to the Board post form
// prefilled from the event; declining leaves the free calendar listing
// exactly as submitted. The event itself is already saved either way.
export default function BoardBoostPrompt({
  title,
  description,
  linkUrl,
  onDecline,
}: {
  title: string;
  description: string;
  linkUrl: string;
  onDecline: () => void;
}) {
  const params = new URLSearchParams({ intent: "event" });
  if (title.trim()) params.set("title", title.trim().slice(0, 80));
  if (description.trim()) params.set("description", description.trim().slice(0, 200));
  if (linkUrl.trim()) params.set("link", linkUrl.trim());

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
      <p className="text-green-800 font-semibold mb-1">Event submitted!</p>
      <p className="text-sm text-gray-700 mt-3">
        Add it to the Gist Board for better visibility? ${(BOARD_PRICE_CENTS / 100).toFixed(0)} for{" "}
        {BOARD_RUN_DAYS} days, and it runs in every weekday issue and on the Board page, not just
        the calendar.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5">
        <Link
          href={`/board/post?${params.toString()}`}
          className="inline-block bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Add to the Board — ${(BOARD_PRICE_CENTS / 100).toFixed(0)}
        </Link>
        <button
          type="button"
          onClick={onDecline}
          className="text-sm text-gray-600 hover:text-gray-900 underline px-2 py-2.5"
        >
          No thanks, just the calendar
        </button>
      </div>
    </div>
  );
}
