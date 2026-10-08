import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { normalizeStations } from "@/lib/deals/gas";

export const dynamic = "force-dynamic";

// Daily gas-price ingest for the Deals Book bento box.
// Secured by bearer secret (GAS_INGEST_SECRET): the daily cron agent can't
// hold an admin session, so it authenticates with this shared secret instead.
// Body: { secret*, workspaceSlug*: "decatur" | "effingham",
//         stations*: [{ name*, regular*: number|null, city? }] }
// Stores the cheapest-first top 10 in the workspace's `gasPrices` Setting.
export async function POST(req: NextRequest) {
  const configured = process.env.GAS_INGEST_SECRET;
  if (!configured) {
    return NextResponse.json({ error: "Ingest not configured" }, { status: 500 });
  }
  const body = (await req.json().catch(() => null)) as {
    secret?: string;
    workspaceSlug?: string;
    stations?: { name?: string; regular?: number | null; city?: string }[];
  } | null;
  if (!body || body.secret !== configured) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !body.workspaceSlug ||
    !Array.isArray(body.stations) ||
    body.stations.length === 0 ||
    body.stations.some((s) => !s || !s.name)
  ) {
    return NextResponse.json(
      { error: "Body needs workspaceSlug and stations[] with names." },
      { status: 400 }
    );
  }
  const workspace = await basePrisma.workspace.findUnique({
    where: { slug: body.workspaceSlug },
  });
  if (!workspace) {
    return NextResponse.json(
      { error: `Workspace "${body.workspaceSlug}" not found.` },
      { status: 400 }
    );
  }
  const stations = normalizeStations(
    body.stations.map((s) => ({
      name: s.name as string,
      regular: typeof s.regular === "number" ? s.regular : null,
      city: s.city,
    }))
  );
  const now = new Date().toISOString();
  await basePrisma.setting.upsert({
    where: { workspaceId_key: { workspaceId: workspace.id, key: "gasPrices" } },
    create: {
      workspaceId: workspace.id,
      key: "gasPrices",
      value: JSON.stringify({ stations, updatedAt: now }),
    },
    update: { value: JSON.stringify({ stations, updatedAt: now }) },
  });
  return NextResponse.json({
    ok: true,
    workspace: body.workspaceSlug,
    stationCount: stations.length,
    cheapest: stations[0] || null,
  });
}
