import { prisma } from "@/lib/db";
import { workspaceUnique, getWorkspaceUrl } from "@/lib/workspace";
import { sendWelcomeEmail } from "@/lib/welcome-email";

// Subscribes a sponsor's contact email to the workspace newsletter when they
// opt in during a sponsor signup flow. Idempotent: an already-active
// subscriber is left untouched, and an inactive one is reactivated.
export async function optInSponsorToNewsletter(email: string, contactName: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) return;
  const firstName = contactName.trim().split(/\s+/)[0] || null;

  const existing = await prisma.subscriber.findUnique({
    where: await workspaceUnique("email", normalizedEmail),
  });
  if (existing?.active) return;

  const subscriber = existing
    ? await prisma.subscriber.update({
        where: await workspaceUnique("email", normalizedEmail),
        data: { active: true, firstName: firstName || existing.firstName },
      })
    : await prisma.subscriber.create({
        data: { email: normalizedEmail, firstName },
      });

  try {
    await sendWelcomeEmail({ id: subscriber.id, email: subscriber.email }, await getWorkspaceUrl());
  } catch {
    // A welcome-email failure must not break the sponsor signup.
  }
}
