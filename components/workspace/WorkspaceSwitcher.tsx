"use client";
import { useEffect, useState, useId } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { pathWorkspace, type WorkspaceInfo } from "@/lib/workspace-constants";
import { useWorkspace } from "./WorkspaceProvider";
import Link from "./WorkspaceLink";
export default function WorkspaceSwitcher() {
  const { workspace } = useWorkspace();
  const inputId = useId();
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([workspace]);
  const [error, setError] = useState("");
  useEffect(() => {
    workspaceFetch("/api/admin/workspaces").then(async r => {
      if (!r.ok) throw new Error("Could not load workspaces");
      setWorkspaces((await r.json()).workspaces);
    }).catch(e => setError(e.message));
  }, []);
  return <div className="mt-5">
    <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Workspace</label>
    <select id={inputId} value={workspace.slug} onChange={e => {
      const path = pathWorkspace(window.location.pathname)?.pathname || window.location.pathname;
      // A full navigation discards draft component state and cached data from the old workspace.
      const destination = path === "/admin/compose" ? "/admin/compose" : "/admin";
      if (path === "/admin/templates" && !window.confirm("Switch workspaces? Save any template changes first.")) return;
      window.location.assign(`/w/${e.target.value}${destination}`);
    }} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900" aria-label="Active newsletter workspace">
      {workspaces.map(w => <option key={w.id} value={w.slug}>{w.name}</option>)}
    </select>
    <Link href="/admin/workspaces" className="mt-2 inline-block text-xs font-medium text-green-800 hover:underline">Manage workspaces →</Link>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}
