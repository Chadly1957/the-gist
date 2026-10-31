import { basePrisma } from "./db-base";
import type { NurtureAudience, NurtureRecipient } from "./sponsor-nurture-shared";

// Server-only audience resolution for sponsor nurture emails. The pure
// types/helpers live in lib/sponsor-nurture-shared.ts (client-safe).
export * from "./sponsor-nurture-shared";

interface Classified {
  free: NurtureRecipient[];
  all: NurtureRecipient[];
  past: NurtureRecipient[];
}

/**
 * Classify the workspace's sponsor profiles once, then serve any segment.
 * "Paid" means a paid/comped/completed week campaign or a partnership in
 * a live-ish state. Opted-out profiles never appear in any segment.
 */
async function classifyProfiles(workspaceId: string): Promise<Classified> {
  const profiles = await basePrisma.sponsorProfile.findMany({
    where: { workspaceId, nurtureOptOut: false },
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      magicToken: true,
      spotlights: {
        where: { status: { in: ["approved", "active"] } },
        select: { id: true },
        take: 1,
      },
      weekBookings: {
        where: { status: { in: ["paid", "comped", "completed"] } },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const partnerProfileIds = new Set(
    (
      await basePrisma.presentingPartnership.findMany({
        where: {
          sponsorProfileId: { not: null },
          status: { in: ["pending_payment", "active", "past_due"] },
        },
        select: { sponsorProfileId: true },
      })
    ).map((p) => p.sponsorProfileId as string)
  );

  const out: Classified = { free: [], all: [], past: [] };
  const seen = new Set<string>();
  for (const p of profiles) {
    if (!p.email || !p.email.includes("@")) continue;
    const key = `${p.email.toLowerCase()}|${p.businessName.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const recipient: NurtureRecipient = {
      id: p.id,
      businessName: p.businessName,
      contactName: p.contactName,
      email: p.email,
      magicToken: p.magicToken,
    };
    out.all.push(recipient);
    const hasPaid = p.weekBookings.length > 0 || partnerProfileIds.has(p.id);
    if (hasPaid) out.past.push(recipient);
    else if (p.spotlights.length > 0) out.free.push(recipient);
  }
  return out;
}

export async function resolveNurtureRecipients(
  workspaceId: string,
  audience: NurtureAudience
): Promise<NurtureRecipient[]> {
  const classified = await classifyProfiles(workspaceId);
  return classified[audience];
}

export async function nurtureAudienceCounts(
  workspaceId: string
): Promise<Record<NurtureAudience, number>> {
  const classified = await classifyProfiles(workspaceId);
  return {
    free: classified.free.length,
    all: classified.all.length,
    past: classified.past.length,
  };
}
