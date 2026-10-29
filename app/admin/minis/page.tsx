"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { workspaceFetch, workspacePath } from "@/lib/workspace-client";

// Admin editor for the $5 guides (internal name: Minis). Customer-facing
// copy always uses the guide title; the word "Mini" must never appear in a
// title, question, or content block.

interface OptionBlock {
  type: "option";
  name: string;
  description: string;
  whyItFits?: string;
  link?: string;
  dealRef?: string;
  tag?: string;
}
type TextBlock = { type: "idea" | "tip"; text: string };
type Block = OptionBlock | TextBlock;

interface MiniRow {
  id: string;
  slug: string;
  title: string;
  question: string;
  content: Block[];
  priceCents: number;
  active: boolean;
  createdAt: string;
  purchaseCount: number;
}

interface OptionForm {
  name: string;
  description: string;
  whyItFits: string;
  link: string;
  dealRef: string;
  tag: string;
}

interface FormState {
  title: string;
  slug: string;
  question: string;
  active: boolean;
  options: OptionForm[];
  ideas: string[];
  tips: string[];
}

const EMPTY_OPTION: OptionForm = { name: "", description: "", whyItFits: "", link: "", dealRef: "", tag: "" };
const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  question: "",
  active: false,
  options: [{ ...EMPTY_OPTION }],
  ideas: [""],
  tips: [""],
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function formFromMini(m: MiniRow): FormState {
  const options: OptionForm[] = [];
  const ideas: string[] = [];
  const tips: string[] = [];
  for (const b of Array.isArray(m.content) ? m.content : []) {
    if (b.type === "option") {
      options.push({
        name: b.name || "",
        description: b.description || "",
        whyItFits: b.whyItFits || "",
        link: b.link || "",
        dealRef: b.dealRef || "",
        tag: b.tag || "",
      });
    } else if (b.type === "idea") ideas.push(b.text || "");
    else if (b.type === "tip") tips.push(b.text || "");
  }
  return {
    title: m.title,
    slug: m.slug,
    question: m.question,
    active: m.active,
    options: options.length ? options : [{ ...EMPTY_OPTION }],
    ideas: ideas.length ? ideas : [""],
    tips: tips.length ? tips : [""],
  };
}

function serialize(form: FormState): Block[] {
  const blocks: Block[] = [];
  for (const o of form.options) {
    if (!o.name.trim() && !o.description.trim()) continue;
    const block: OptionBlock = { type: "option", name: o.name.trim(), description: o.description.trim() };
    if (o.whyItFits.trim()) block.whyItFits = o.whyItFits.trim();
    if (o.link.trim()) block.link = o.link.trim();
    if (o.dealRef.trim()) block.dealRef = o.dealRef.trim();
    if (o.tag.trim()) block.tag = o.tag.trim();
    blocks.push(block);
  }
  for (const t of form.ideas) if (t.trim()) blocks.push({ type: "idea", text: t.trim() });
  for (const t of form.tips) if (t.trim()) blocks.push({ type: "tip", text: t.trim() });
  return blocks;
}

export default function MinisPage() {
  const [list, setList] = useState<MiniRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState("");
  const [copyTargets, setCopyTargets] = useState<Record<string, string>>({});
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workspaceFetch("/api/admin/minis");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load guides.");
      setList(data.minis || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load guides.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      try {
        const res = await workspaceFetch("/api/admin/workspaces");
        const data = await res.json();
        if (res.ok) {
          setWorkspaces(data.workspaces || []);
          setCurrentWorkspaceId(data.currentId || "");
        }
      } catch {
        // Copy is a nice-to-have; the editor works without the list.
      }
    })();
  }, [load]);

  const otherWorkspaces = workspaces.filter((w) => w.id !== currentWorkspaceId);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function openEdit(m: MiniRow) {
    setEditingId(m.id);
    setForm(formFromMini(m));
    setSlugTouched(true);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        title: form.title,
        slug: form.slug,
        question: form.question,
        active: form.active,
        content: serialize(form),
      };
      const url = editingId ? `/api/admin/minis/${editingId}` : "/api/admin/minis";
      const res = await workspaceFetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSuccess(editingId ? "Guide updated." : "Guide created.");
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: MiniRow) {
    setError("");
    setSuccess("");
    try {
      const res = await workspaceFetch(`/api/admin/minis/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !m.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the guide.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the guide.");
    }
  }

  async function copyMini(m: MiniRow) {
    const targetWorkspaceId = copyTargets[m.id] || otherWorkspaces[0]?.id || "";
    if (!targetWorkspaceId) return;
    setCopyingId(m.id);
    setError("");
    setSuccess("");
    try {
      const res = await workspaceFetch(`/api/admin/minis/${m.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWorkspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Copy failed.");
      setSuccess(`Copied "${m.title}" to ${data.targetName} as an inactive draft (slug: ${data.copy.slug}). Localize it there before activating.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed.");
    } finally {
      setCopyingId(null);
    }
  }

  function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }

  const inputCls = "mt-1 w-full border rounded-lg px-3 py-2";
  const labelCls = "block text-sm font-medium";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Minis (Guides)</h1>
          <p className="text-sm text-gray-500 mt-1">
            The $5 guides for this city. Customers see them as guides (for example, &ldquo;Date Night
            Guide&rdquo;): never put the word &ldquo;Mini&rdquo; in a title, question, or content.
            Saving is live immediately; inactive guides keep working for existing owners but cannot
            be bought.
          </p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shrink-0">
          + New Guide
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={submit} className="mb-8 p-5 border rounded-xl bg-gray-50 space-y-5">
          <h2 className="font-semibold">{editingId ? "Edit guide" : "New guide"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className={labelCls}>
              <span>Title (customer-facing)</span>
              <input
                required
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
                }}
                className={inputCls}
                placeholder="Date Night Guide"
              />
            </label>
            <label className={labelCls}>
              <span>Slug (URL: /minis/&lt;slug&gt;)</span>
              <input
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
                className={inputCls}
                placeholder="date-night-guide"
              />
            </label>
            <label className={`${labelCls} md:col-span-2`}>
              <span>The question this guide answers</span>
              <input
                required
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                className={inputCls}
                placeholder="Where should we go for date night?"
              />
            </label>
            <label className="flex items-start gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="mt-1"
              />
              <span>
                <span className="text-sm font-medium">Active</span>
                <span className="block text-xs text-gray-400">
                  Active guides can be bought and show their teaser page. An active guide needs at
                  least one option. Inactive guides stay readable for owners.
                </span>
              </span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Options</h3>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, options: [...f.options, { ...EMPTY_OPTION }] }))}
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-100"
              >
                + Add option
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Option names are the teaser: non-buyers see the names and counts only. Descriptions,
              why-it-fits, links, deal notes, and tags are the paid content. Tags group the options
              inside the guide (Splurge, Casual, Budget, and so on) and power its filter chips.
            </p>
            <div className="space-y-4">
              {form.options.map((o, i) => (
                <div key={i} className="p-4 border rounded-xl bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Option {i + 1}</span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setForm((f) => ({ ...f, options: move(f.options, i, -1) }))} className="px-2 py-1 border rounded text-xs hover:bg-gray-100">↑</button>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, options: move(f.options, i, 1) }))} className="px-2 py-1 border rounded text-xs hover:bg-gray-100">↓</button>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i) }))} className="px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50">Remove</button>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={`${labelCls} md:col-span-2`}>
                      <span>Name</span>
                      <input value={o.name} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))} className={inputCls} placeholder="Downtown dinner and a walk" />
                    </label>
                    <label className={labelCls}>
                      <span>Tag (optional, groups this option)</span>
                      <input value={o.tag} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, tag: e.target.value } : x)) }))} className={inputCls} placeholder="e.g. Splurge, Casual, Late Night, Budget" />
                    </label>
                    <label className={labelCls}>
                      <span>Deal note (optional, shown to owners)</span>
                      <input value={o.dealRef} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, dealRef: e.target.value } : x)) }))} className={inputCls} placeholder="e.g. $5 off with the Deals coupon inside" />
                    </label>
                    <label className={`${labelCls} md:col-span-2`}>
                      <span>Description</span>
                      <textarea value={o.description} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) }))} className={inputCls} rows={2} placeholder="What it is and how the night goes." />
                    </label>
                    <label className={`${labelCls} md:col-span-2`}>
                      <span>Why it fits (optional)</span>
                      <input value={o.whyItFits} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, whyItFits: e.target.value } : x)) }))} className={inputCls} placeholder="Easy to plan, easy to bail on if the night runs long." />
                    </label>
                    <label className={`${labelCls} md:col-span-2`}>
                      <span>Link (optional, http/https)</span>
                      <input value={o.link} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)) }))} className={inputCls} placeholder="https://…" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(
            [
              ["ideas", "Ideas", "Short actionable ideas, one per line. Owners only."],
              ["tips", "Tips", "Practical notes: timing, cost, reservations. Owners only."],
            ] as const
          ).map(([key, label, hint]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{label}</h3>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, [key]: [...f[key], ""] }))}
                  className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-100"
                >
                  + Add {label === "Ideas" ? "idea" : "tip"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">{hint}</p>
              <div className="space-y-2">
                {form[key].map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={t}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: f[key].map((x, j) => (j === i ? e.target.value : x)) }))}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder={label === "Ideas" ? "Set a start time, not just a day." : "Book weekend reservations before the week starts."}
                    />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, [key]: move(f[key], i, -1) }))} className="px-2 py-1 border rounded text-xs hover:bg-gray-100">↑</button>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, [key]: move(f[key], i, 1) }))} className="px-2 py-1 border rounded text-xs hover:bg-gray-100">↓</button>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }))} className="px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
              {saving ? "Saving…" : editingId ? "Save changes" : "Create guide"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading guides…</p>
      ) : list.length === 0 ? (
        <div className="p-5 border rounded-xl bg-gray-50 text-sm text-gray-600">
          No guides in this city yet. Create the first one above, or copy one in from another city
          once it exists there.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <div key={m.id} className="p-4 border rounded-xl bg-white flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{m.title}</span>
                    <span
                      className={`text-xs font-semibold rounded-full px-2 py-0.5 ${m.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                    >
                      {m.active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs text-gray-400">{m.purchaseCount} purchases</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{m.question}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    /minis/{m.slug} ·{" "}
                    <a href={workspacePath(`/minis/${m.slug}`)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      View teaser page
                    </a>
                    {" · "}
                    <a href={workspacePath(`/deals?preview=${m.slug}#guide-${m.slug}`)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      View in portal (owner view)
                    </a>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(m)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-100">
                    Edit
                  </button>
                  <button onClick={() => toggleActive(m)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-100">
                    {m.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
              {otherWorkspaces.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <span className="text-xs text-gray-500">Copy to another city as an inactive draft:</span>
                  <select
                    value={copyTargets[m.id] || otherWorkspaces[0]?.id || ""}
                    onChange={(e) => setCopyTargets((t) => ({ ...t, [m.id]: e.target.value }))}
                    className="border rounded-lg px-2 py-1.5 text-sm"
                  >
                    {otherWorkspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => copyMini(m)}
                    disabled={copyingId === m.id}
                    className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50"
                  >
                    {copyingId === m.id ? "Copying…" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
