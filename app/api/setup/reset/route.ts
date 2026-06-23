import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Updates the existing admin user's email and password to match the
// current ADMIN_EMAIL and ADMIN_PASSWORD env vars.
// Safe to call any time you change credentials in Vercel — env var
// access is restricted to the project owner, so this is the proof of
// authorization.
export async function GET() {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      return NextResponse.json(
        { error: "ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables." },
        { status: 400 }
      );
    }

    const existing = await prisma.adminUser.findFirst();
    if (!existing) {
      return NextResponse.json(
        { error: "No admin user found. Run /api/setup first." },
        { status: 404 }
      );
    }

    const hashed = await hashPassword(password);
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: { email, password: hashed },
    });

    return NextResponse.json({
      message: `Admin credentials updated for ${email}. You can now log in at /admin/login.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Reset failed.", detail: message },
      { status: 500 }
    );
  }
}
