"use client";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { WorkspaceInfo } from "@/lib/workspace-constants";
type WorkspaceSummary = WorkspaceInfo & { _count: { subscriberRows: number; sourceRows: number; newsletterSendRows: number } };
export default function WorkspacesPage() {
  const { workspace } = useWorkspace();
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [slug, setSlug] = useState("");
  useEffect(() => {
    workspaceFetch("/api/admin/workspaces").then(async r => {
      if (!r.ok) throw new Error("Could not load workspaces. Please reload to try again.");
      setItems((await r.json()).workspaces);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const response = await workspaceFetch("/api/admin/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, area, slug }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create workspace.");
      window.location.assign(`/w/${data.workspace.slug}/admin`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create workspace."); setSaving(false); }
  }
  return <div className="max-w-6xl mx-auto p-5 md:p-10">
    <p className="text-xs uppercase tracking-widest font-bold text-green-700">The Gist · Your newsletters</p>
    <h1 className="mt-2 text-3xl font-bold text-gray-900">Workspaces</h1>
    <p className="mt-3 max-w-2xl text-gray-600">One home for every community. Each workspace has its own subscribers, Community Partners, sponsors, sources, templates, games, settings, and newsletter history.</p>
    {error && <p role="alert" className="my-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    {loading ? <p role="status" className="my-8 text-gray-500">Loading workspaces…</p> : <div className="grid gap-5 mt-8 md:grid-cols-2">
      {items.map(item => <section key={item.id} className={`rounded-2xl bg-white border p-6 ${item.id === workspace.id ? "border-green-600 ring-1 ring-green-600" : "border-gray-200"}`}>
        <div className="flex justify-between gap-3"><p className="text-sm text-gray-500">{item.area}</p>{item.id === workspace.id && <span className="text-xs font-semibold text-green-800 bg-green-50 px-2 py-1 rounded-full">Current workspace</span>}</div>
        <h2 className="text-xl font-semibold mt-2">{item.name}</h2>
        <div className="flex gap-6 mt-6 text-sm"><p><strong className="block text-xl">{item._count.subscriberRows.toLocaleString()}</strong>Subscribers</p><p><strong className="block text-xl">{item._count.sourceRows}</strong>Sources</p><p><strong className="block text-xl">{item._count.newsletterSendRows}</strong>Issues</p></div>
        <div className="flex gap-5 mt-6"><WorkspaceAnchor href={`/w/${item.slug}/admin`} className="text-sm font-semibold text-green-800 hover:underline">Open workspace →</WorkspaceAnchor><WorkspaceAnchor href={`/w/${item.slug}`} target="_blank" rel="noreferrer" className="text-sm text-gray-600 hover:underline">View website ↗</WorkspaceAnchor></div>
      </section>)}
    </div>}
    <form onSubmit={create} className="mt-10 rounded-2xl bg-white border border-gray-200 p-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Add a community</h2><p className="text-sm text-gray-500 mt-2 mb-6">Start with an empty workspace. Your existing newsletters and subscriber lists stay where they are.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Newsletter name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="The Gist Huntsville" className="mt-1 block w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm font-medium">Town or area<input required maxLength={100} value={area} onChange={e => { setArea(e.target.value); if (!slug || slug === area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Huntsville" className="mt-1 block w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm font-medium sm:col-span-2">Workspace URL<input required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e => setSlug(e.target.value)} placeholder="huntsville" className="mt-1 block w-full rounded-lg border p-2.5" /><span className="block mt-1 text-xs text-gray-500">/w/{slug || "your-town"}</span></label>
      </div>
      <button disabled={saving} className="mt-6 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : "Create workspace"}</button>
    </form>
  </div>;
}
