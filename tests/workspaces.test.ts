import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient, Prisma } from "@prisma/client";
import { scopeQuery } from "../lib/workspace-scope";
import { pathWorkspace } from "../lib/workspace-constants";
import { workspacePath } from "../lib/workspace-client";

const baseline = readFileSync("prisma/migrations/20260921000000_baseline/migration.sql", "utf8");
const migration = readFileSync("prisma/migrations/20260921010000_workspaces/migration.sql", "utf8");

test("workspace paths preserve external links and isolate admin and public routes", () => {
  assert.equal(pathWorkspace("/w/huntsville/admin/compose")?.slug, "huntsville");
  assert.equal(pathWorkspace("/w/huntsville/admin/compose")?.pathname, "/admin/compose");
  assert.equal(pathWorkspace("/admin"), null);
  assert.equal(workspacePath("/api/subscribe", "/w/huntsville"), "/w/huntsville/api/subscribe");
  assert.equal(workspacePath("/admin", "/w/huntsville"), "/w/huntsville/admin");
  assert.equal(workspacePath("https://example.com", "/w/huntsville"), "https://example.com");
  assert.equal(workspacePath("/w/decatur/admin", "/w/huntsville"), "/w/decatur/admin");
});

test("all newsletter models are scoped and ownership cannot be reassigned", () => {
  for (const model of Prisma.dmmf.datamodel.models.filter(m => !["Workspace", "AdminUser"].includes(m.name))) {
    assert.equal(scopeQuery(model.name, "findMany", { where: { OR: [{ workspaceId: "other" }] } }, "decatur").where.workspaceId, "decatur");
    assert.equal(scopeQuery(model.name, "create", { data: {} }, "town").data.workspaceId, "town");
    assert.throws(() => scopeQuery(model.name, "update", { data: { workspaceId: "other" } }, "town"));
  }
  assert.throws(() => scopeQuery("SponsorProfile", "create", { data: { spotlights: { connect: { id: "other" } } } }, "town"));
});

test("migration preserves legacy data; real Prisma reads, writes, unique keys and relations remain isolated", async () => {
  const db = await PGlite.create();
  await db.exec(baseline);
  await db.exec(`INSERT INTO "Subscriber" (id,email) VALUES ('legacy','reader@example.com'); INSERT INTO "Setting" (id,key,value) VALUES ('setting','smtp_pass','legacy-secret');`);
  await db.exec(migration);
  const old = await db.query<{ workspaceId: string }>('SELECT "workspaceId" FROM "Subscriber" WHERE id=\'legacy\'');
  assert.equal(old.rows[0].workspaceId, "decatur");
  const server = new PGLiteSocketServer({ db, port: 55439, host: "127.0.0.1" });
  await server.start();
  const base = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1" } } });
  const client = (workspaceId: string) => base.$extends({ query: { $allModels: { $allOperations: ({ model, operation, args, query }) => query(scopeQuery(model, operation, args, workspaceId)) } } });
  const decatur = client("decatur"), town = client("town");
  async function rejected(query: PromiseLike<unknown>) {
    await assert.rejects(Promise.resolve(query));
    // PGlite closes the wire connection after an error; reconnect between cases.
    await base.$disconnect();
  }
  try {
    await base.workspace.create({ data: { id: "town", slug: "town", name: "The Gist Town", area: "Town" } });
    assert.equal(await town.subscriber.count(), 0);
    assert.equal(await town.setting.count(), 0);
    await town.subscriber.create({ data: { email: "reader@example.com" } });
    assert.equal(await decatur.subscriber.count(), 1);
    assert.equal(await town.subscriber.count(), 1);
    await rejected(town.subscriber.create({ data: { email: "reader@example.com" } }));
    assert.equal(await town.subscriber.findUnique({ where: { id: "legacy" } }), null);
    await rejected(town.subscriber.update({ where: { id: "legacy" }, data: { active: false } }));
    await rejected(town.subscriber.delete({ where: { id: "legacy" } }));
    await town.setting.upsert({ where: { workspaceId_key: { workspaceId: "town", key: "smtp_pass" } }, create: { key: "smtp_pass", value: "new-secret" }, update: { value: "new-secret" } });
    assert.equal((await decatur.setting.findFirst())?.value, "legacy-secret");
    await town.wordyWord.create({ data: { date: "2026-09-21", word: "TOWNS" } });
    await decatur.wordyWord.create({ data: { date: "2026-09-21", word: "LOCAL" } });
    const sponsor = await decatur.sponsorProfile.create({ data: { email: "sponsor@example.com", businessName: "Old", contactName: "Person" } });
    await rejected(town.spotlightListing.create({ data: { sponsorId: sponsor.id, businessName: "Bad", description: "Bad", ctaUrl: "https://example.com" } }));
    const own = await town.sponsorProfile.create({ data: { email: "sponsor@example.com", businessName: "New", contactName: "Person" } });
    await town.spotlightListing.create({ data: { sponsorId: own.id, businessName: "New", description: "Good", ctaUrl: "https://example.com" } });
    assert.equal((await town.spotlightListing.findFirst({ include: { sponsor: true } }))?.sponsor.workspaceId, "town");
    await town.subscriber.createMany({ data: [{ email: "bulk@example.com" }, { email: "bulk2@example.com" }] });
    assert.equal(await town.subscriber.count(), 3);
    await town.subscriber.updateMany({ data: { active: false } });
    assert.equal((await decatur.subscriber.findUnique({ where: { id: "legacy" } }))?.active, true);
    await town.subscriber.deleteMany({});
    assert.equal(await decatur.subscriber.count(), 1);
    assert.equal(await town.subscriber.count(), 0);
    const groups = await town.wordyWord.groupBy({ by: ["date"], _count: true });
    assert.equal(groups[0]._count, 1);
  } finally {
    await base.$disconnect(); await server.stop(); await db.close();
  }
});

test("email credentials, sender identity and generated URLs stay within their workspace", async () => {
  const { withWorkspace, getWorkspace, getWorkspaceUrl } = await import("../lib/workspace");
  const { getEmailClient } = await import("../lib/email");
  const town = { id: "town", slug: "town", name: "The Gist Town", area: "Town", domain: null, latitude: null, longitude: null, timezone: null };
  const decatur = { ...town, id: "decatur", slug: "decatur", name: "The Gist Decatur" };
  const oldKey = process.env.RESEND_API_KEY;
  const oldUrl = process.env.NEXT_PUBLIC_APP_URL;
  const oldFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "test-decatur-key";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
  try {
    assert.equal(await withWorkspace(town, () => getEmailClient({})), null);
    assert.equal(await withWorkspace(town, () => getEmailClient({ email_provider: "resend", resend_api_key: "town-key", smtp_from: "wrong@example.test" })), null);
    const client = await withWorkspace(town, () => getEmailClient({ email_provider: "resend", resend_api_key: "town-key", resend_from_email: "town@example.test" }));
    assert.ok(client);
    let sent: any;
    globalThis.fetch = (async (_url, init) => {
      sent = { headers: init?.headers, body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ id: "mock-only" }), { status: 200 });
    }) as typeof fetch;
    await client.sendEmail({ to: "test@example.test", subject: "Test", htmlBody: "Test" });
    assert.equal(sent.body.from, "The Gist Town <town@example.test>");
    assert.equal(sent.headers.Authorization, "Bearer town-key");
    assert.equal(await withWorkspace(town, getWorkspaceUrl), "https://example.test/w/town");
    assert.equal(await withWorkspace(decatur, getWorkspaceUrl), "https://example.test");
    assert.deepEqual(await Promise.all([
      withWorkspace(town, async () => { await Promise.resolve(); return (await getWorkspace()).id; }),
      withWorkspace(decatur, async () => { await Promise.resolve(); return (await getWorkspace()).id; }),
    ]), ["town", "decatur"]);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = oldUrl;
  }
});
