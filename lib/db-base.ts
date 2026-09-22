import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { basePrisma?: PrismaClient };
// Unscoped access is reserved for workspace resolution, migrations and verified system jobs.
export const basePrisma = globalForPrisma.basePrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.basePrisma = basePrisma;
