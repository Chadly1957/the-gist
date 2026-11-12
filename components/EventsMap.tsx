"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { dayHeader } from "@/lib/event-dates";
import type { HubEvent } from "./EventsHub";

// Leaflet map for the /events hub. Rendered only on the client (the hub
// loads this with next/dynamic ssr:false), so Leaflet never runs during
// server rendering.
//
// Stack: Leaflet + CARTO basemap tiles over OpenStreetMap data. $0, no
// Google services, no metered APIs, no Mapbox account. Attribution stays
// visible (Leaflet's own prefix plus CARTO and OpenStreetMap on the tile
// layer), which is both a license requirement and a quiet signal we are
// not renting Google.
//
// Pins are divIcons, so there are no default marker image assets to
// break under Next: a green dot for community events, a green star for
// partner-hosted ones. MapLibre GL was deliberately left out: the pins
// sit on CARTO's raster tiles, and the vector renderer adds a WebGL
// dependency and bundle weight for no visible difference here.

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STAR_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="#fff" aria-hidden="true"><path d="M12 2l2.9 6.26 6.6.57-5 4.36 1.5 6.45L12 16.9 5.99 19.64l1.5-6.45-5-4.36 6.6-.57z"/></svg>';

function pinIcon(ev: HubEvent, active: boolean): L.DivIcon {
  const isPartner = ev.sponsorId != null;
  const cls = `ev-pin${isPartner ? " ev-pin-partner" : ""}${active ? " ev-pin-active" : ""}`;
  return L.divIcon({
    className: "ev-div-icon",
    html: `<span class="${cls}">${isPartner ? STAR_SVG : ""}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Popup card: category eyebrow, title, full date and time, location,
// cost, description, host when a sponsor is attached, and an outbound
// link to the event's own page. Titles and descriptions are reader- and
// sponsor-submitted, so everything is escaped; events with no url
// simply omit the link, never a fabricated one.
function popupHtml(ev: HubEvent): string {
  const eyebrow = ev.sponsor?.businessName
    ? `Hosted by ${escapeHtml(ev.sponsor.businessName)}`
    : "Community event";
  const when = `${dayHeader(ev.eventDate)}${
    ev.startTime ? ` · ${escapeHtml(ev.startTime)}` : ""
  }`;
  const parts = [
    `<p class="ev-pop-eyebrow">${eyebrow}</p>`,
    `<p class="ev-pop-title">${escapeHtml(ev.title)}</p>`,
    `<p class="ev-pop-meta">${when}</p>`,
  ];
  if (ev.location) parts.push(`<p class="ev-pop-meta">${escapeHtml(ev.location)}</p>`);
  if (ev.cost) parts.push(`<p class="ev-pop-meta">${escapeHtml(ev.cost)}</p>`);
  if (ev.description)
    parts.push(`<p class="ev-pop-desc">${escapeHtml(ev.description)}</p>`);
  if (ev.url)
    parts.push(
      `<a class="ev-pop-link" href="${escapeHtml(ev.url)}" target="_blank" rel="noopener noreferrer">Full listing →</a>`,
    );
  return parts.join("");
}

interface EventsMapProps {
  events: HubEvent[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
}

export default function EventsMap({
  events,
  center,
  selectedId,
  hoveredId,
  onSelect,
  visible,
}: EventsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once. Scroll-wheel zoom stays off so the map never
  // traps the page scroll; the +/- control, double-click, and pinch
  // still zoom.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    map.setView([center.lat, center.lng], 13);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Center is fixed for the page load; the empty deps are intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild markers only when the visible set changes. Highlight changes
  // below update icons in place, so an open popup never closes on hover.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const id of Object.keys(markersRef.current)) {
      markersRef.current[id].remove();
    }
    markersRef.current = {};
    const bounds: L.LatLng[] = [];
    for (const ev of events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const marker = L.marker([ev.latitude, ev.longitude], {
        icon: pinIcon(ev, ev.id === selectedId || ev.id === hoveredId),
      });
      // Touch screens get the hub's bottom-sheet card instead of a
      // Leaflet popup, so the two never stack on top of each other.
      if (!isCoarsePointer()) marker.bindPopup(popupHtml(ev), { maxWidth: 300 });
      marker.on("click", () => onSelectRef.current(ev.id));
      marker.addTo(map);
      markersRef.current[ev.id] = marker;
      bounds.push(L.latLng(ev.latitude, ev.longitude));
    }
    // Frame the pins the first time any appear; later filter changes
    // leave the reader's pan and zoom alone.
    if (!fittedRef.current && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
      fittedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Highlight the selected / hovered pin in place.
  useEffect(() => {
    for (const ev of events) {
      const marker = markersRef.current[ev.id];
      if (marker) {
        marker.setIcon(pinIcon(ev, ev.id === selectedId || ev.id === hoveredId));
      }
    }
  }, [events, selectedId, hoveredId]);

  // A selection made from the list rail pans to the pin and opens its
  // popup (desktop only; touch uses the bottom sheet).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selectedId) {
      map.closePopup();
      return;
    }
    const marker = markersRef.current[selectedId];
    if (!marker) return;
    map.panTo(marker.getLatLng(), { animate: true });
    if (!isCoarsePointer()) marker.openPopup();
  }, [selectedId]);

  // The map mounts hidden behind the List view; size it once it shows.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [visible]);

  return <div ref={containerRef} className="h-full w-full" />;
}
