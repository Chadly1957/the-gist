import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getAdminSession } from "@/lib/auth";
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

// Upload a workspace branding image (logo or hero) to R2.
// Returns the public URL; the caller saves it on the workspace via PATCH
// /api/admin/workspaces. Admin-only.
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const workspaceId = formData?.get("workspaceId");
  const kind = formData?.get("kind");
  const file = formData?.get("file");
  if (typeof workspaceId !== "string" || !workspaceId) {
    return NextResponse.json({ error: "Workspace is required." }, { status: 400 });
  }
  if (kind !== "logo" && kind !== "hero") {
    return NextResponse.json({ error: "Kind must be logo or hero." }, { status: 400 });
  }
  const workspace = await basePrisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }
  if (file.type !== "image/png" && file.type !== "image/jpeg" && file.type !== "image/webp") {
    return NextResponse.json({ error: "Image must be a PNG, JPG, or WebP." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
  }

  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!r2 || !bucket || !publicUrl) {
    return NextResponse.json({ error: "Image uploads are not configured right now. Please try again later." }, { status: 500 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `branding/${workspaceId}/${kind}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }));

  return NextResponse.json({ url: `${publicUrl}/${key}` });
}
