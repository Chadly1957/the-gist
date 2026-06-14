import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// One-time setup endpoint — creates the admin user from env vars.
// Self-disables once an admin user exists.
export async function GET() {
  const existingAdmin = await prisma.adminUser.findFirst();
  if (existingAdmin) {
    return NextResponse.json(
      { error: "Setup already complete. An admin user already exists." },
      { status: 403 }
    );
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables." },
      { status: 400 }
    );
  }

  const hashed = await hashPassword(password);
  await prisma.adminUser.create({
    data: { id: `admin_${Date.now()}`, email, password: hashed },
  });

  return NextResponse.json({
    message: `Admin user created for ${email}. You can now log in at /admin/login. This endpoint is now permanently disabled.`,
  });
}
