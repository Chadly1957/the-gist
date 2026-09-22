// Disposable local database for workspace UI verification; never uses DATABASE_URL.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
async function main() {
  const db = await PGlite.create();
  await db.exec(readFileSync("prisma/migrations/20260921000000_baseline/migration.sql", "utf8"));
  await db.exec(readFileSync("prisma/migrations/20260921010000_workspaces/migration.sql", "utf8"));
  await db.query('INSERT INTO "AdminUser" (id,email,password) VALUES ($1,$2,$3)', ["dev-admin", "admin@example.test", await bcrypt.hash("workspace-preview", 10)]);
  await db.exec(`INSERT INTO "Subscriber" (id,email) VALUES ('demo-reader','decatur@example.test');`);
  await db.query('INSERT INTO "Workspace" (id,slug,name,area) VALUES ($1,$2,$3,$4)', ["preview-huntsville", "huntsville-preview", "The Gist Huntsville (Preview)", "Huntsville"]);
  const server = new PGLiteSocketServer({ db, port: 55440, host: "127.0.0.1" });
  await server.start();
  console.log("Disposable workspace DB ready at 127.0.0.1:55440");
  process.on("SIGINT", async () => { await server.stop(); await db.close(); process.exit(0); });
}
main().catch(e => { console.error(e); process.exit(1); });
