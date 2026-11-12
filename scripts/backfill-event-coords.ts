// One-time backfill: geocode every approved event that has a location
// but no pin yet (events approved before the map shipped, plus any the
// nightly sweep has not reached).
//
// Usage (needs the production DATABASE_URL in the environment):
//   DATABASE_URL="postgresql://..." npx tsx scripts/backfill-event-coords.ts
//
// One lookup per second, per Nominatim's usage policy. Only ADDS
// coordinates; it never moves or clears an existing pin, and an event
// that cannot be placed stays list-only for the nightly sweep to retry.
import { basePrisma } from "../lib/db-base";
import { geocodeAndStoreEvent, sleepBetweenLookups } from "../lib/geocode";

async function main() {
  const pending = await basePrisma.event.findMany({
    where: { status: "approved", location: { not: null }, latitude: null },
    orderBy: { eventDate: "asc" },
    select: { id: true, title: true, location: true, workspaceId: true },
  });
  console.log(`Found ${pending.length} approved event(s) without coordinates.`);
  let pinned = 0;
  let skipped = 0;
  for (let i = 0; i < pending.length; i++) {
    const ev = pending[i];
    if (i > 0) await sleepBetweenLookups();
    const hit = await geocodeAndStoreEvent(ev.id, ev.location, ev.workspaceId);
    if (hit) {
      pinned++;
      console.log(`pinned  ${ev.title} -> ${hit.latitude}, ${hit.longitude}`);
    } else {
      skipped++;
      console.log(`skipped ${ev.title} (${ev.location})`);
    }
  }
  console.log(`Done: ${pinned} pinned, ${skipped} still list-only.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
