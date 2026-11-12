"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "@/components/workspace/WorkspaceLink";
import EventsSubscribe from "@/components/EventsSubscribe";
import EventCard from "@/components/EventCard";
import { addDays, dayChipLabel, dayHeader, startMinutes } from "@/lib/event-dates";

// The public /events hub: the v1 day-grouped list plus a map view.
// One query feeds both views; the map is a view of the calendar, never
// a second dataset. List stays the default: it is the accessible,
// scannable view and the one the newsletter trains readers to expect.
const EventsMap = dynamic(() => import("@/components/EventsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

export interface HubEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  url: string | null;
  cost: string | null;
  latitude: number | null;
  longitude: number | null;
  sponsorId: string | null;
  sponsor: { businessName: string } | null;
}

interface EventsHubProps {
  events: HubEvent[];
  area: string;
  center: { lat: number; lng: number };
  today: string;
}

type View = "list" | "map";

interface Layers {
  all: boolean;
  partner: boolean;
  free: boolean;
}

function isFreeEvent(ev: HubEvent): boolean {
  return !ev.cost || ev.cost.trim().toLowerCase() === "free";
}

// Events come back date-ordered, so group them in a single pass.
// (Plain arrays only: the repo tsconfig targets ES5, where iterating
// a Map iterator does not type-check.)
function groupByDay(evs: HubEvent[]): { date: string; items: HubEvent[] }[] {
  const days: { date: string; items: HubEvent[] }[] = [];
  for (const ev of evs) {
    const current = days[days.length - 1];
    if (current && current.date === ev.eventDate) current.items.push(ev);
    else days.push({ date: ev.eventDate, items: [ev] });
  }
  for (const day of days) {
    day.items.sort((a, b) => startMinutes(a.startTime) - startMinutes(b.startTime));
  }
  return days;
}

function EventsCtas({ area }: { area: string }) {
  return (
    <>
      <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
        <p className="font-bold text-gray-900 mb-1">Get this in your inbox</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          The free morning email with {area}&apos;s news, deals, and this calendar, in your
          inbox before your coffee gets cold.
        </p>
        <EventsSubscribe />
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <p className="font-bold text-gray-900 mb-1">Own a local business?</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Put your events and your business in front of {area} readers every morning.
        </p>
        <Link
          href="/sponsor"
          className="inline-block px-4 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
        >
          Advertise with The Gist
        </Link>
      </div>
    </>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
      <p className="text-gray-500 text-sm mb-1">
        {filtered ? "Nothing matches those filters." : "Nothing on the calendar yet."}
      </p>
      <p className="text-gray-400 text-sm">
        {filtered
          ? "Try another day or turn a layer back on."
          : "Know about something coming up? Add it with the submit button above."}
      </p>
    </div>
  );
}

export default function EventsHub({ events, area, center, today }: EventsHubProps) {
  const [view, setView] = useState<View>("list");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [layers, setLayers] = useState<Layers>({ all: true, partner: false, free: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const tomorrow = addDays(today, 1);

  // Layer filters stack as a union: an event shows when it matches any
  // enabled layer, and "All events" matches everything. Default is all
  // on, so the first paint matches the v1 calendar exactly.
  const layerFiltered = useMemo(() => {
    return events.filter((ev) => {
      if (layers.all) return true;
      if (layers.partner && ev.sponsorId) return true;
      if (layers.free && isFreeEvent(ev)) return true;
      return false;
    });
  }, [events, layers]);

  const visibleEvents = useMemo(() => {
    if (dayFilter === "all") return layerFiltered;
    if (dayFilter === "today") return layerFiltered.filter((ev) => ev.eventDate === today);
    return layerFiltered.filter((ev) => ev.eventDate === dayFilter);
  }, [layerFiltered, dayFilter, today]);

  const days = useMemo(() => groupByDay(visibleEvents), [visibleEvents]);
  const mapEvents = useMemo(
    () => visibleEvents.filter((ev) => ev.latitude != null && ev.longitude != null),
    [visibleEvents],
  );

  // Day chips: All, Today, then the next 7 days. Counts come from the
  // layer-filtered set; a chip with no events on that day is disabled.
  const chips = useMemo(() => {
    const counts: Record<string, number> = { all: layerFiltered.length, today: 0 };
    for (const ev of layerFiltered) {
      if (ev.eventDate === today) counts.today++;
      counts[ev.eventDate] = (counts[ev.eventDate] || 0) + 1;
    }
    const out: { key: string; label: string; count: number }[] = [
      { key: "all", label: "All", count: counts.all },
      { key: "today", label: "Today", count: counts.today },
    ];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(today, i);
      out.push({ key: d, label: dayChipLabel(d), count: counts[d] || 0 });
    }
    return out;
  }, [layerFiltered, today]);

  const filtersActive =
    dayFilter !== "all" || !layers.all || layers.partner || layers.free;

  const selectedEvent =
    visibleEvents.find((ev) => ev.id === selectedId) || null;

  // A selection that no longer matches the filters clears itself, so
  // the map never highlights an event that is not on screen.
  useEffect(() => {
    if (selectedId && !visibleEvents.some((ev) => ev.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visibleEvents, selectedId]);

  // In map view, keep the selected card in sight in the rail.
  useEffect(() => {
    if (!selectedId || view !== "map") return;
    document
      .getElementById(`event-card-${selectedId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId, view]);

  return (
    <div
      className={`${
        view === "map" ? "max-w-7xl" : "max-w-2xl"
      } mx-auto px-4 sm:px-6 py-10 sm:py-14`}
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
          What&apos;s Happening in {area}
        </h1>
        <p className="text-gray-500">
          Concerts, markets, trivia nights, and everything else going on around town,
          straight from the morning newsletter&apos;s calendar.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/events/submit"
            className="inline-block px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            Submit an Event
          </Link>
          <div
            className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
            role="tablist"
            aria-label="Calendar view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                view === "list" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "map"}
              onClick={() => setView("map")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                view === "map" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              Map
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Free to submit. Events are reviewed before they run.
        </p>
      </div>

      <div className="mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              disabled={chip.count === 0}
              onClick={() => setDayFilter(chip.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-sm font-semibold transition-colors ${
                dayFilter === chip.key
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-700 border-gray-200 hover:border-green-500"
              } disabled:opacity-40 disabled:cursor-default`}
            >
              {chip.label}
              <span className="ml-1.5 text-xs opacity-70">{chip.count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
          {(
            [
              ["all", "All events"],
              ["partner", "Hosted by a partner"],
              ["free", "Free events"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
                className="w-4 h-4 accent-green-700"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Both views stay mounted so the map keeps its pan and zoom
          across toggles; the inactive one is hidden. The map resizes
          itself when it becomes visible again. */}
      <div className={view === "list" ? "" : "hidden"}>
        <div>
          {days.length === 0 ? (
            <EmptyState filtered={filtersActive} />
          ) : (
            days.map(({ date: dateStr, items: dayEvents }) => (
              <div key={dateStr} className="mb-10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  {dayHeader(dateStr)}
                  {dateStr === today && (
                    <span className="ml-2 normal-case tracking-normal text-green-700">
                      · Today
                    </span>
                  )}
                  {dateStr === tomorrow && (
                    <span className="ml-2 normal-case tracking-normal text-green-700">
                      · Tomorrow
                    </span>
                  )}
                </h2>
                <div className="space-y-4">
                  {dayEvents.map((ev) => (
                    <EventCard key={ev.id} ev={ev} />
                  ))}
                </div>
              </div>
            ))
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12">
            <EventsCtas area={area} />
          </div>
        </div>
      </div>
      <div className={view === "map" ? "" : "hidden"}>
        <div>
          {visibleEvents.length === 0 ? (
            <EmptyState filtered={filtersActive} />
          ) : (
            <div className="lg:flex lg:gap-4 lg:h-[720px]">
              <div className="hidden lg:block lg:w-[380px] lg:shrink-0 lg:border lg:border-gray-200 lg:rounded-2xl lg:p-4 lg:overflow-y-auto">
                {days.map(({ date: dateStr, items: dayEvents }) => (
                  <div key={dateStr} className="mb-8">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                      {dayHeader(dateStr)}
                      {dateStr === today && (
                        <span className="ml-2 normal-case tracking-normal text-green-700">
                          · Today
                        </span>
                      )}
                      {dateStr === tomorrow && (
                        <span className="ml-2 normal-case tracking-normal text-green-700">
                          · Tomorrow
                        </span>
                      )}
                    </h2>
                    <div className="space-y-3">
                      {dayEvents.map((ev) => (
                        <EventCard
                          key={ev.id}
                          ev={ev}
                          domId={`event-card-${ev.id}`}
                          selected={ev.id === selectedId}
                          onSelect={setSelectedId}
                          onHover={setHoveredId}
                          showUnpinnedNote
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-6 space-y-3">
                  <EventsCtas area={area} />
                </div>
              </div>
              <div className="relative h-[65vh] lg:h-auto lg:flex-1 rounded-2xl overflow-hidden border border-gray-200">
                <EventsMap
                  events={mapEvents}
                  center={center}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={setSelectedId}
                  visible={view === "map"}
                />
                <Link
                  href="/events/submit"
                  className="absolute top-3 right-3 z-[500] px-3 py-2 bg-white border border-gray-200 rounded-lg shadow text-sm font-semibold text-gray-800 hover:border-green-500"
                >
                  + Submit an Event
                </Link>
                {selectedEvent && (
                  <div className="absolute inset-x-3 bottom-3 z-[500] lg:hidden">
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Close event details"
                        onClick={() => setSelectedId(null)}
                        className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-white border border-gray-200 shadow text-gray-600 font-bold leading-none"
                      >
                        ×
                      </button>
                      <EventCard ev={selectedEvent} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
