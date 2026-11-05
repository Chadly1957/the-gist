import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Media Kit template upload: same R2 store and credentials as
// /api/admin/upload, but with a 15 MB cap instead of 5 MB (a print
// resolution 2550x3300 flyer template legitimately exceeds 5 MB as a
// PNG) and keys namespaced under media-kit/ so templates are easy to
// tell apart from article/product images in the bucket.

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
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Template image must be under 15MB." }, { status: 400 });

  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (!r2 || !bucket || !publicUrl) {
    return NextResponse.json({ error: "Image storage is not configured (R2 env vars missing)." }, { status: 500 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const key = `media-kit/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }));

  return NextResponse.json({ url: `${publicUrl}/${key}` });
}
