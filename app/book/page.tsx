import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Google Calendar appointment schedule ("Book a call with Chad - The
// Gist Decatur") on the chad@thegistdecatur.com calendar: 30-minute
// calls, Google Meet link created on booking. The same schedule is
// embedded on every city domain, so the page copy stays city-neutral.
const BOOKING_EMBED_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ24c6DJVym9Cn8xiI9vST-ZRFKAgLshNS8eiNM1uPTc99SthVqd5NfEO7HiC1oEdNhmae8m6fjR?gv=true";
const BOOKING_DIRECT_URL = "https://calendar.app.google/wmKY9DkDbZxFk2Ah8";

export async function generateMetadata(): Promise<Metadata> {
  const ws = await getWorkspace();
  return {
    title: `Book a call with Chad | ${ws.name}`,
    description:
      "Pick a 30-minute time that works for you. We'll meet on Google Meet to talk sponsoring, partnerships, or anything else.",
  };
}

// Public booking page: the Google Calendar booking page embedded
// inline, with a direct link underneath as a fallback for browsers
// that block the embed.
export default function BookPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
            The Gist
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
            Book a call with Chad
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Pick a 30-minute time that works for you. We&apos;ll meet on
            Google Meet to talk sponsoring, partnerships, or anything else.
          </p>
        </div>

        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
          <iframe
            src={BOOKING_EMBED_URL}
            title="Book a call with Chad"
            className="block w-full h-[820px] sm:h-[720px]"
            style={{ border: 0 }}
          />
        </div>

        <p className="text-sm text-gray-500 text-center mt-4">
          Calendar not loading?{" "}
          <a
            href={BOOKING_DIRECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-green-700 hover:text-green-800 underline"
          >
            Open the booking page
          </a>
        </p>

        <p className="text-sm text-gray-500 text-center mt-8">
          Want the details first?{" "}
          <Link
            href="/sponsor"
            className="font-semibold text-green-700 hover:text-green-800 underline"
          >
            See sponsorship options
          </Link>
        </p>
      </div>
    </div>
  );
}
