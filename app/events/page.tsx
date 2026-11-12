import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import EventsSubscribe from "@/components/EventsSubscribe";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public events calendar for this workspace: every approved event from
// today onward, grouped by day. Approved events used to run only in the
// morning newsletter; this page is the same calendar on the web, with
// the submit flow and signup/business CTAs alongside it.

// Today's date (YYYY-MM-DD) in the workspace's timezone, matching the
// plain date strings events are stored with.
function todayIn(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "Tuesday, November 10" from a YYYY-MM-DD string. Built from the parts
// in UTC so the weekday never drifts with the server's timezone.
function dayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// Best-effort in-day ordering: parse a leading clock time ("7:00 PM",
// "9 AM") into minutes. Anything unparseable sorts after timed events
// and keeps its original order (Array.sort is stable).
function startMinutes(startTime: string | null): number {
  if (!startTime) return Number.MAX_SAFE_INTEGER;
  const m = startTime.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  if (h > 23) return Number.MAX_SAFE_INTEGER;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
}

export default async function EventsPage() {
  const ws = await getWorkspace();
  const today = todayIn(ws.timezone || "America/Chicago");
  const tomorrow = addDays(today, 1);

  const events = await prisma.event.findMany({
    where: { workspaceId: ws.id, status: "approved", eventDate: { gte: today } },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      eventDate: true,
      startTime: true,
      endTime: true,
      location: true,
      url: true,
      cost: true,
      sponsor: { select: { businessName: true } },
    },
  });

  // Events come back date-ordered, so group them in a single pass.
  // (Plain arrays only: the repo tsconfig targets ES5, where iterating
  // a Map iterator does not type-check.)
  type EventRow = (typeof events)[number];
  const days: { date: string; items: EventRow[] }[] = [];
  for (const ev of events) {
    const current = days[days.length - 1];
    if (current && current.date === ev.eventDate) current.items.push(ev);
    else days.push({ date: ev.eventDate, items: [ev] });
  }
  for (const day of days) {
    day.items.sort((a, b) => startMinutes(a.startTime) - startMinutes(b.startTime));
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            What&apos;s Happening in {ws.area} IL
          </h1>
          <p className="text-gray-500">
            Concerts, markets, trivia nights, and everything else going on around
            town, straight from the morning newsletter&apos;s calendar.
          </p>
          <Link
            href="/events/submit"
            className="inline-block mt-6 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            Submit an Event
          </Link>
          <p className="text-xs text-gray-400 mt-2">
            Free to submit. Events are reviewed before they run.
          </p>
        </div>

        {days.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-500 text-sm mb-1">Nothing on the calendar yet.</p>
            <p className="text-gray-400 text-sm">
              Know about something coming up? Add it with the submit button above.
            </p>
          </div>
        ) : (
          days.map(({ date: dateStr, items: dayEvents }) => (
            <div key={dateStr} className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                {dayHeader(dateStr)}
                {dateStr === today && (
                  <span className="ml-2 normal-case tracking-normal text-green-700">· Today</span>
                )}
                {dateStr === tomorrow && (
                  <span className="ml-2 normal-case tracking-normal text-green-700">· Tomorrow</span>
                )}
              </h2>
              <div className="space-y-4">
                {dayEvents.map((ev) => {
                  const time = ev.startTime
                    ? ev.endTime
                      ? `${ev.startTime} – ${ev.endTime}`
                      : ev.startTime
                    : null;
                  const meta = [time, ev.location, ev.cost].filter(Boolean).join(" · ");
                  return (
                    <div key={ev.id} className="border border-gray-200 rounded-2xl p-5">
                      <p className="font-bold text-gray-900">{ev.title}</p>
                      {meta && <p className="text-sm text-gray-500 mt-1">{meta}</p>}
                      {ev.description && (
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{ev.description}</p>
                      )}
                      {ev.sponsor?.businessName && (
                        <p className="text-xs text-gray-400 mt-2">
                          Hosted by {ev.sponsor.businessName}
                        </p>
                      )}
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-3 text-sm font-semibold text-green-700 hover:underline"
                        >
                          More info →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
            <p className="font-bold text-gray-900 mb-1">Get this in your inbox</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              The free morning email with {ws.area}&apos;s news, deals, and this
              calendar, in your inbox before your coffee gets cold.
            </p>
            <EventsSubscribe />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900 mb-1">Own a local business?</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Put your events and your business in front of {ws.area} readers
              every morning.
            </p>
            <Link
              href="/sponsor"
              className="inline-block px-4 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
            >
              Advertise with The Gist
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
