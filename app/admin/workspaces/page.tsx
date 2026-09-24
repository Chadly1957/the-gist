"use client";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { WorkspaceInfo } from "@/lib/workspace-constants";
type WorkspaceSummary = WorkspaceInfo & { _count: { subscriberRows: number; sourceRows: number; newsletterSendRows: number } };

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

function tzLabel(value: string | null) {
  return TIMEZONES.find((t) => t.value === value)?.label || value || "—";
}

function WorkspaceEditor({
  workspace,
  onSaved,
}: {
  workspace: WorkspaceSummary;
  onSaved: (w: WorkspaceSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [area, setArea] = useState(workspace.area);
  const [latitude, setLatitude] = useState(workspace.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(workspace.longitude?.toString() ?? "");
  const [timezone, setTimezone] = useState(workspace.timezone ?? "America/Chicago");
  const [primaryColor, setPrimaryColor] = useState(workspace.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(workspace.secondaryColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await workspaceFetch("/api/admin/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspace.id, name, area, latitude, longitude, timezone, primaryColor, secondaryColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save workspace.");
      onSaved({ ...workspace, name: data.workspace.name, area: data.workspace.area, latitude: data.workspace.latitude, longitude: data.workspace.longitude, timezone: data.workspace.timezone, primaryColor: data.workspace.primaryColor, secondaryColor: data.workspace.secondaryColor });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save workspace.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-green-700 hover:underline">
        Edit workspace
      </button>
    );
  }

  return (
    <form onSubmit={save} className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-600">Newsletter name
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">Town or area
          <input required maxLength={100} value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-600">Latitude
          <input required value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="39.8403" inputMode="decimal" className="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">Longitude
          <input required value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-88.9454" inputMode="decimal" className="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm" />
        </label>
      </div>
      <label className="text-xs font-medium text-gray-600">Timezone
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm">
          {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-600">Primary color
          <span className="mt-1 flex items-center gap-2">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white p-1" />
            <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} className="block w-full rounded-lg border border-gray-200 p-2 text-sm font-mono" />
          </span>
          <span className="block mt-1 text-[11px] font-normal text-gray-400">Buttons, links, accents</span>
        </label>
        <label className="text-xs font-medium text-gray-600">Secondary color
          <span className="mt-1 flex items-center gap-2">
            <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white p-1" />
            <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} className="block w-full rounded-lg border border-gray-200 p-2 text-sm font-mono" />
          </span>
          <span className="block mt-1 text-[11px] font-normal text-gray-400">Darker headings, email header</span>
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={saving} className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export default function WorkspacesPage() {
  const { workspace } = useWorkspace();
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [slug, setSlug] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [primaryColor, setPrimaryColor] = useState("#15803d");
  const [secondaryColor, setSecondaryColor] = useState("#166534");
  useEffect(() => {
    workspaceFetch("/api/admin/workspaces").then(async r => {
      if (!r.ok) throw new Error("Could not load workspaces. Please reload to try again.");
      setItems((await r.json()).workspaces);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const response = await workspaceFetch("/api/admin/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, area, slug, latitude, longitude, timezone, primaryColor, secondaryColor }) });
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
        <p className="text-xs text-gray-500 mt-1">
          📍 {item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : "No location set"} · {tzLabel(item.timezone)}
        </p>
        <p className="mt-2 flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded-full border border-gray-200" style={{ background: item.primaryColor }} title={`Primary ${item.primaryColor}`} />
          <span className="inline-block h-5 w-5 rounded-full border border-gray-200" style={{ background: item.secondaryColor }} title={`Secondary ${item.secondaryColor}`} />
          <span className="text-xs text-gray-400 font-mono">{item.primaryColor} · {item.secondaryColor}</span>
        </p>
        <div className="flex gap-6 mt-6 text-sm"><p><strong className="block text-xl">{item._count.subscriberRows.toLocaleString()}</strong>Subscribers</p><p><strong className="block text-xl">{item._count.sourceRows}</strong>Sources</p><p><strong className="block text-xl">{item._count.newsletterSendRows}</strong>Issues</p></div>
        <div className="flex gap-5 mt-6 items-center"><WorkspaceAnchor href={`/w/${item.slug}/admin`} className="text-sm font-semibold text-green-800 hover:underline">Open workspace →</WorkspaceAnchor><WorkspaceAnchor href={`/w/${item.slug}`} target="_blank" rel="noreferrer" className="text-sm text-gray-600 hover:underline">View website ↗</WorkspaceAnchor></div>
        <div className="mt-4 border-t border-gray-100 pt-3">
          <WorkspaceEditor workspace={item} onSaved={(w) => setItems((items) => items.map((i) => i.id === w.id ? w : i))} />
        </div>
      </section>)}
    </div>}
    <form onSubmit={create} className="mt-10 rounded-2xl bg-white border border-gray-200 p-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Add a community</h2><p className="text-sm text-gray-500 mt-2 mb-6">Start with an empty workspace. Your existing newsletters and subscriber lists stay where they are.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Newsletter name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="The Gist Huntsville" className="mt-1 block w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm font-medium">Town or area<input required maxLength={100} value={area} onChange={e => { setArea(e.target.value); if (!slug || slug === area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Huntsville" className="mt-1 block w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm font-medium sm:col-span-2">Workspace URL<input required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e => setSlug(e.target.value)} placeholder="huntsville" className="mt-1 block w-full rounded-lg border p-2.5" /><span className="block mt-1 text-xs text-gray-500">/w/{slug || "your-town"}</span></label>
      </div>
      <div className="mt-4 rounded-xl bg-sky-50 border border-sky-200 p-4">
        <p className="text-sm font-semibold text-sky-900">Location</p>
        <p className="text-xs text-sky-700 mt-1 mb-3">Powers location features like the weather block. Look up any city's coordinates with a quick search, e.g. "Effingham IL latitude longitude".</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Latitude<input required value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="39.0997" inputMode="decimal" className="mt-1 block w-full rounded-lg border p-2.5 bg-white" /></label>
          <label className="text-sm font-medium">Longitude<input required value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="-88.5451" inputMode="decimal" className="mt-1 block w-full rounded-lg border p-2.5 bg-white" /></label>
          <label className="text-sm font-medium">Timezone
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 bg-white">
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-violet-50 border border-violet-200 p-4">
        <p className="text-sm font-semibold text-violet-900">Brand colors</p>
        <p className="text-xs text-violet-700 mt-1 mb-3">Gives this city its own look on the website and in emails. Primary drives buttons and links; secondary drives darker headings and the email header.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Primary color
            <span className="mt-1 flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-gray-200 bg-white p-1" />
              <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} className="block w-full rounded-lg border p-2.5 bg-white font-mono" />
            </span>
          </label>
          <label className="text-sm font-medium">Secondary color
            <span className="mt-1 flex items-center gap-2">
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-gray-200 bg-white p-1" />
              <input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} className="block w-full rounded-lg border p-2.5 bg-white font-mono" />
            </span>
          </label>
        </div>
      </div>
      <button disabled={saving} className="mt-6 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : "Create workspace"}</button>
    </form>
  </div>;
}
