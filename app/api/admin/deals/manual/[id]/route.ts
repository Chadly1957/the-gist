import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { updateManualDeal, deleteManualDeal } from "@/lib/deals/manual";

export const dynamic = "force-dynamic";

// Update a manual deal. Same validation as creation; workspace-scoped.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  try {
    const deal = await updateManualDeal(workspace.id, params.id, await req.json());
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

// Delete a manual deal. Workspace-scoped; manual-pipeline deals only.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  try {
    const result = await deleteManualDeal(workspace.id, params.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
