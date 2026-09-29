import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { basePrisma } from "@/lib/db-base";

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

// Logo upload for the paid weekly flow. Scoped to a live hold token so the
// public endpoint can't be abused as free image hosting.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const holdToken = formData.get("holdToken") as string | null;
  const file = formData.get("file") as File | null;

  if (!holdToken) return NextResponse.json({ error: "Hold token required." }, { status: 401 });

  const workspace = await getWorkspace();
  const hold = await basePrisma.sponsorHold.findFirst({
    where: { workspaceId: workspace.id, holdToken, expiresAt: { gt: new Date() } },
  });
  if (!hold) return NextResponse.json({ error: "Your reservation expired. Please pick a week again." }, { status: 401 });

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    return NextResponse.json({ error: "Logo must be a PNG or JPG." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });

  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (!r2 || !bucket || !publicUrl) {
    return NextResponse.json({ error: "Image uploads are not configured right now. Please try again later." }, { status: 500 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
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
