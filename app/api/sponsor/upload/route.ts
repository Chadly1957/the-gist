import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = formData.get("token") as string | null;
  const file = formData.get("file") as File | null;

  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });

  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (!r2 || !bucket || !publicUrl) {
    return NextResponse.json({ error: "Image uploads not configured. Please paste an image URL instead." }, { status: 500 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const key = `sponsors/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }));

  return NextResponse.json({ url: `${publicUrl}/${key}` });
}
