import type { HubEvent } from "./EventsHub";

interface EventCardProps {
  ev: HubEvent;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  // Map view only: flag events whose location never resolved to a pin,
  // so nothing silently vanishes from the map.
  showUnpinnedNote?: boolean;
  // Map view rail only: a DOM id the hub scrolls to when a pin is
  // tapped. Left off everywhere else so the id stays unique.
  domId?: string;
}

// One event card, shared by the list view and the map view's rail, so
// both views always show the same card for the same event.
export default function EventCard({
  ev,
  selected,
  onSelect,
  onHover,
  showUnpinnedNote,
  domId,
}: EventCardProps) {
  const time = ev.startTime ? (ev.endTime ? `${ev.startTime} – ${ev.endTime}` : ev.startTime) : null;
  const meta = [time, ev.location, ev.cost].filter(Boolean).join(" · ");
  return (
    <div
      id={domId}
      onClick={() => onSelect?.(ev.id)}
      onMouseEnter={() => onHover?.(ev.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`border rounded-2xl p-5 transition-colors ${
        onSelect ? "cursor-pointer" : ""
      } ${
        selected
          ? "border-green-700 ring-2 ring-green-700/30 bg-green-50/40"
          : "border-gray-200 hover:border-green-300"
      }`}
    >
      <p className="font-bold text-gray-900">{ev.title}</p>
      {meta && <p className="text-sm text-gray-500 mt-1">{meta}</p>}
      {ev.description && (
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{ev.description}</p>
      )}
      {ev.sponsor?.businessName && (
        <p className="text-xs text-gray-400 mt-2">Hosted by {ev.sponsor.businessName}</p>
      )}
      {showUnpinnedNote && ev.latitude == null && (
        <p className="text-xs text-gray-400 mt-2">Location not pinned on the map yet</p>
      )}
      {ev.url && (
        <a
          href={ev.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-block mt-3 text-sm font-semibold text-green-700 hover:underline"
        >
          More info →
        </a>
      )}
    </div>
  );
}
