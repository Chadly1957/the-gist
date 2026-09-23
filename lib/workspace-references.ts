import { basePrisma } from "./db-base";
// These historical ID columns are not Prisma relations. Validate ownership before
// writes without changing existing deletion semantics. Batch recipient imports
// require one lookup per relation, rather than a lookup for every subscriber.
const references: Record<string, Record<string, string>> = {
  NewsletterRecipient: { subscriberId: "subscriber" },
  ReferralCode: { subscriberId: "subscriber" },
  ReferralSignup: { newSubscriberId: "subscriber" },
  WordyPlay: { recipientId: "newsletterRecipient" },
  PollVote: { recipientId: "newsletterRecipient" },
  Poll: { newsletterSendId: "newsletterSend" },
};
export async function validateWorkspaceReferences(model: string, operation: string, args: any, workspaceId: string) {
  const fields = references[model];
  if (!fields) return;
  const data = operation === "upsert" ? [args.create, args.update] : args.data;
  const rows = (Array.isArray(data) ? data : [data]).filter(Boolean);
  for (const [field, delegate] of Object.entries(fields)) {
    const ids = Array.from(new Set(rows.map(row => row[field]).filter(id => id != null)));
    if (!ids.length) continue;
    if (ids.some(id => typeof id !== "string")) throw new Error(`Invalid ${field}`);
    const count = await (basePrisma as any)[delegate].count({ where: { id: { in: ids }, workspaceId } });
    if (count !== ids.length) throw new Error(`${field} does not belong to this workspace`);
  }
}
