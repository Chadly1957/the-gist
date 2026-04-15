import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@thegistdecatur.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";

  const hashed = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, password: hashed },
  });

  // Default sources
  const sources = [
    { name: "Decatur Daily", url: "https://www.decaturdaily.com" },
    { name: "AL.com Decatur", url: "https://www.al.com/news/decatur" },
  ];

  for (const source of sources) {
    await prisma.source.upsert({
      where: { url: source.url },
      update: {},
      create: source,
    });
  }

  // Default template
  const defaultBlocks = JSON.stringify([
    {
      id: "header-1",
      type: "header",
      content: {
        title: "The Gist Decatur",
        subtitle: "Your daily briefing from Decatur",
        date: "{{DATE}}",
      },
    },
    {
      id: "text-1",
      type: "text",
      content: {
        html: "<p>Good morning! Here's what's happening in Decatur today.</p>",
      },
    },
    {
      id: "articles-1",
      type: "articles",
      content: { label: "Today's Top Stories" },
    },
    {
      id: "divider-1",
      type: "divider",
      content: {},
    },
    {
      id: "footer-1",
      type: "footer",
      content: {
        text: "You're receiving this because you signed up at thegistdecatur.com",
        unsubscribeText: "Unsubscribe",
      },
    },
  ]);

  await prisma.template.upsert({
    where: { id: "default-template" },
    update: {},
    create: {
      id: "default-template",
      name: "Default Newsletter",
      blocks: defaultBlocks,
      isDefault: true,
    },
  });

  console.log("Seed complete. Admin:", adminEmail);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
