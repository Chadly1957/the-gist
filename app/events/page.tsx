import "leaflet/dist/leaflet.css";
import SiteHeader from "@/components/SiteHeader";
import EventsHub from "@/components/EventsHub";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { todayIn } from "@/lib/event-dates";

export const dynamic = "force-dynamic";

// Public events calendar for this workspace: every approved event from
// today onward. The interactive hub (List | Map toggle, day chips,
// layer filters) lives in EventsHub; this page just fetches the data
// and the workspace's map center.

// Fallback map centers, used only when the workspace record has no
// stored latitude/longitude yet.
const FALLBACK_CENTERS: Record<string, { lat: number; lng: number }> = {
  decatur: { lat: 39.8403, lng: -88.9548 },
  effingham: { lat: 39.12, lng: -88.5426 },
};

export default async function EventsPage() {
  const ws = await getWorkspace();
  const today = todayIn(ws.timezone || "America/Chicago");

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
      latitude: true,
      longitude: true,
      sponsorId: true,
      sponsor: { select: { businessName: true } },
    },
  });

  const center =
    ws.latitude != null && ws.longitude != null
      ? { lat: ws.latitude, lng: ws.longitude }
      : FALLBACK_CENTERS[ws.slug] || FALLBACK_CENTERS.decatur;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <EventsHub events={events} area={ws.area} center={center} today={today} />
    </div>
  );
}
