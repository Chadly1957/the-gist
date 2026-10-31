"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { workspaceFetch } from "@/lib/workspace-client";
import {
  NURTURE_AUDIENCE_LABELS,
  newBlock,
  starterBlocks,
  type NurtureAudience,
  type NurtureBlock,
  type NurtureBlockType,
} from "@/lib/sponsor-nurture-shared";
import { renderNurtureEmail } from "@/lib/sponsor-nurture-render";

interface TemplateItem {
  id: string;
  name: string;
  subject: string;
  blocks: NurtureBlock[];
  updatedAt: string;
}
interface CampaignItem {
  id: string;
  templateId: string | null;
  name: string;
  subject: string;
  blocks: NurtureBlock[];
  audience: NurtureAudience;
  status: "draft" | "sending" | "sent";
  sentAt: string | null;
  recipientCount: number;
  failedCount: number;
  updatedAt: string;
}

interface Draft {
  kind: "template" | "campaign";
  id: string | null;
  name: string;
  subject: string;
  blocks: NurtureBlock[];
  audience: NurtureAudience;
  templateId: string | null;
  status: "draft" | "sending" | "sent";
}

const BLOCK_TYPE_LABELS: Record<NurtureBlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
};

export default function SponsorNurture() {
  const { workspace } = useWorkspace();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [counts, setCounts] = useState<Record<NurtureAudience, number>>({ free: 0, all: 0, past: 0 });
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        workspaceFetch("/api/admin/sponsors/nurture/templates"),
        workspaceFetch("/api/admin/sponsors/nurture/campaigns"),
      ]);
      const t = await tRes.json();
      const c = await cRes.json();
      if (tRes.ok) setTemplates(t.templates || []);
      if (cRes.ok) {
        setCampaigns(c.campaigns || []);
        if (c.counts) setCounts(c.counts);
      }
    } catch {
      setError("Could not load nurture emails.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openTemplate(t: TemplateItem | null, useStarter: boolean) {
    setError("");
    setNotice("");
    if (t) {
      setDraft({ kind: "template", id: t.id, name: t.name, subject: t.subject, blocks: t.blocks, audience: "free", templateId: null, status: "draft" });
    } else {
      setDraft({ kind: "template", id: null, name: "", subject: "", blocks: useStarter ? starterBlocks() : [], audience: "free", templateId: null, status: "draft" });
    }
  }

  function openCampaign(c: CampaignItem | null, fromTemplate?: TemplateItem) {
    setError("");
    setNotice("");
    if (c) {
      setDraft({ kind: "campaign", id: c.id, name: c.name, subject: c.subject, blocks: c.blocks, audience: c.audience, templateId: c.templateId, status: c.status });
    } else if (fromTemplate) {
      setDraft({ kind: "campaign", id: null, name: fromTemplate.name, subject: fromTemplate.subject, blocks: fromTemplate.blocks, audience: "free", templateId: fromTemplate.id, status: "draft" });
    } else {
      setDraft({ kind: "campaign", id: null, name: "", subject: "", blocks: starterBlocks(), audience: "free", templateId: null, status: "draft" });
    }
  }

  function duplicateCampaign(c: CampaignItem) {
    setError("");
    setNotice("");
    setDraft({ kind: "campaign", id: null, name: `${c.name} (copy)`, subject: c.subject, blocks: c.blocks, audience: c.audience, templateId: c.templateId, status: "draft" });
  }

  async function saveDraft(): Promise<string | null> {
    if (!draft) return null;
    setBusy("save");
    setError("");
    try {
      const isTemplate = draft.kind === "template";
      const url = isTemplate ? "/api/admin/sponsors/nurture/templates" : "/api/admin/sponsors/nurture/campaigns";
      const body: Record<string, unknown> = { name: draft.name, subject: draft.subject, blocks: draft.blocks };
      if (!isTemplate) {
        body.audience = draft.audience;
        body.templateId = draft.templateId;
      }
      const res = await workspaceFetch(draft.id ? `${url}/${draft.id}` : url, {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      const saved = isTemplate ? data.template : data.campaign;
      setDraft({ ...draft, id: saved.id });
      setNotice("Saved.");
      await load();
      return saved.id as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function deleteItem(kind: "template" | "campaign", id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    setBusy(`delete-${id}`);
    try {
      const base = kind === "template" ? "/api/admin/sponsors/nurture/templates" : "/api/admin/sponsors/nurture/campaigns";
      const res = await workspaceFetch(`${base}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      if (draft?.id === id) setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy("");
    }
  }

  async function testSend() {
    if (!draft || draft.kind !== "campaign") return;
    const id = draft.id ?? (await saveDraft());
    if (!id) return;
    setBusy("test");
    setError("");
    try {
      const res = await workspaceFetch(`/api/admin/sponsors/nurture/campaigns/${id}/test-send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test send failed.");
      setNotice(`Test sent to ${data.sentTo}. Merge tags are filled in as "Sample Bakery".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed.");
    } finally {
      setBusy("");
    }
  }

  async function sendCampaign() {
    if (!draft || draft.kind !== "campaign") return;
    const count = counts[draft.audience];
    if (!window.confirm(`Send "${draft.name}" to ${count} businesses (${NURTURE_AUDIENCE_LABELS[draft.audience]})?`)) return;
    const id = draft.id ?? (await saveDraft());
    if (!id) return;
    setBusy("send");
    setError("");
    try {
      const res = await workspaceFetch(`/api/admin/sponsors/nurture/campaigns/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed.");
      setDraft(null);
      setNotice(`Sent to ${data.recipientCount} businesses${data.failedCount ? `, ${data.failedCount} failed` : ""}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy("");
    }
  }

  if (draft) {
    return (
      <NurtureEditor
        draft={draft}
        setDraft={setDraft}
        counts={counts}
        busy={busy}
        notice={notice}
        error={error}
        workspaceName={workspace.name}
        brandColor={workspace.primaryColor || "#15803d"}
        onBack={() => { setDraft(null); setNotice(""); setError(""); load(); }}
        onSave={saveDraft}
        onTestSend={testSend}
        onSend={sendCampaign}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Nurture emails</h2>
        <p className="text-sm text-gray-500 max-w-2xl">
          Bulk email to the businesses in this city, built from reusable templates. The default audience is your free
          businesses: listed in the directory, never paid. Right now that is{" "}
          <strong className="text-gray-700">{counts.free} businesses</strong> here ({counts.all} total profiles,{" "}
          {counts.past} past advertisers). Anyone who unsubscribes is excluded automatically.
        </p>
      </div>

      {notice && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">{notice}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Base templates</h3>
          <div className="flex gap-2">
            <button onClick={() => openTemplate(null, true)} className="text-xs font-semibold bg-green-700 hover:bg-green-800 text-white px-3 py-2 rounded-lg">
              New from starter layout
            </button>
            <button onClick={() => openTemplate(null, false)} className="text-xs font-semibold border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-2 rounded-lg">
              New blank template
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 py-4">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No templates yet. Create one from the starter layout, then start emails from it.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.blocks.length} blocks · subject: {t.subject || "(none)"}</p>
                </div>
                <button onClick={() => openCampaign(null, t)} className="text-xs font-semibold bg-green-700 hover:bg-green-800 text-white px-3 py-2 rounded-lg">
                  New email from template
                </button>
                <button onClick={() => openTemplate(t, false)} className="text-xs font-semibold border border-gray-300 text-gray-700 px-3 py-2 rounded-lg">
                  Edit
                </button>
                <button onClick={() => deleteItem("template", t.id, t.name)} disabled={busy === `delete-${t.id}`} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Emails</h3>
          <button onClick={() => openCampaign(null)} className="text-xs font-semibold bg-green-700 hover:bg-green-800 text-white px-3 py-2 rounded-lg">
            New email (starter layout)
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 py-4">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No emails yet. Start one from a template above.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {campaigns.map((c) => (
              <div key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {NURTURE_AUDIENCE_LABELS[c.audience]}
                    {c.status === "sent" && c.sentAt
                      ? ` · sent ${new Date(c.sentAt).toLocaleDateString()} to ${c.recipientCount}${c.failedCount ? ` (${c.failedCount} failed)` : ""}`
                      : ` · edited ${new Date(c.updatedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${c.status === "sent" ? "bg-green-100 text-green-700" : c.status === "sending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                  {c.status.toUpperCase()}
                </span>
                <button onClick={() => openCampaign(c)} className="text-xs font-semibold border border-gray-300 text-gray-700 px-3 py-2 rounded-lg">
                  {c.status === "sent" ? "View" : "Edit"}
                </button>
                <button onClick={() => duplicateCampaign(c)} className="text-xs font-semibold border border-gray-300 text-gray-700 px-3 py-2 rounded-lg">
                  Duplicate
                </button>
                <button onClick={() => deleteItem("campaign", c.id, c.name)} disabled={busy === `delete-${c.id}`} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NurtureEditor(props: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  counts: Record<NurtureAudience, number>;
  busy: string;
  notice: string;
  error: string;
  workspaceName: string;
  brandColor: string;
  onBack: () => void;
  onSave: () => Promise<string | null>;
  onTestSend: () => Promise<void>;
  onSend: () => Promise<void>;
}) {
  const { draft, setDraft, counts, busy, notice, error } = props;
  const readOnly = draft.kind === "campaign" && draft.status === "sent";
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<number>(-1);
  const [uploading, setUploading] = useState(false);

  function updateBlock(i: number, patch: Partial<NurtureBlock>) {
    const blocks = draft.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b));
    setDraft({ ...draft, blocks });
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.blocks.length) return;
    const blocks = [...draft.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    setDraft({ ...draft, blocks });
  }
  function removeBlock(i: number) {
    setDraft({ ...draft, blocks: draft.blocks.filter((_, j) => j !== i) });
  }
  function addBlock(type: NurtureBlockType) {
    setDraft({ ...draft, blocks: [...draft.blocks, newBlock(type)] });
  }

  async function handleUpload(file: File) {
    const i = uploadTarget.current;
    if (i < 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await workspaceFetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      updateBlock(i, { url: data.url });
    } catch {
      window.alert("Image upload failed. You can paste an image URL instead.");
    } finally {
      setUploading(false);
    }
  }

  const previewHtml = renderNurtureEmail(draft.blocks, {
    businessName: "Sample Bakery",
    contactName: "Sam",
    workspaceName: props.workspaceName,
    brandColor: props.brandColor,
    appUrl: "",
    portalUrl: "#",
    unsubscribeUrl: "#",
  });

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

  return (
    <div>
      <button onClick={props.onBack} className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Back to nurture emails
      </button>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h2 className="text-lg font-semibold text-gray-900">
          {draft.kind === "template" ? "Template" : "Email"}: {draft.name || "Untitled"}
        </h2>
        {readOnly && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">SENT (READ-ONLY)</span>}
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Merge tags: <code>{"{{businessName}}"}</code> and <code>{"{{contactName}}"}</code> fill in per business in the subject, headings, and text.
      </p>

      {notice && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">{notice}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <label className={labelCls}>{draft.kind === "template" ? "Template name *" : "Email name *"}</label>
              <input value={draft.name} disabled={readOnly} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. November check-in" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Subject line</label>
              <input value={draft.subject} disabled={readOnly} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="A quick note for {{businessName}}" className={inputCls} />
            </div>
            {draft.kind === "campaign" && (
              <div>
                <label className={labelCls}>Audience</label>
                <select value={draft.audience} disabled={readOnly} onChange={(e) => setDraft({ ...draft, audience: e.target.value as NurtureAudience })} className={inputCls}>
                  {(Object.keys(NURTURE_AUDIENCE_LABELS) as NurtureAudience[]).map((a) => (
                    <option key={a} value={a}>
                      {NURTURE_AUDIENCE_LABELS[a]} ({counts[a]})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {draft.blocks.map((block, i) => (
            <div key={block.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex-1">{BLOCK_TYPE_LABELS[block.type]}</span>
                {!readOnly && (
                  <>
                    <button onClick={() => moveBlock(i, -1)} disabled={i === 0} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↑</button>
                    <button onClick={() => moveBlock(i, 1)} disabled={i === draft.blocks.length - 1} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↓</button>
                    <button onClick={() => removeBlock(i)} className="text-xs text-red-500 hover:underline px-1">Remove</button>
                  </>
                )}
              </div>
              {block.type === "heading" && (
                <input value={block.text || ""} disabled={readOnly} onChange={(e) => updateBlock(i, { text: e.target.value })} placeholder="Heading text" className={inputCls} />
              )}
              {block.type === "text" && (
                <textarea value={block.text || ""} disabled={readOnly} onChange={(e) => updateBlock(i, { text: e.target.value })} rows={5} placeholder={"Write your message. Blank lines start a new paragraph.\n\nHi {{contactName}}, …"} className={`${inputCls} resize-y`} />
              )}
              {block.type === "image" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={block.url || ""} disabled={readOnly} onChange={(e) => updateBlock(i, { url: e.target.value })} placeholder="Image URL" className={inputCls} />
                    {!readOnly && (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => { uploadTarget.current = i; fileRef.current?.click(); }}
                        className="shrink-0 text-xs font-semibold border border-gray-300 text-gray-700 px-3 rounded-lg disabled:opacity-50"
                      >
                        {uploading ? "Uploading…" : "Upload"}
                      </button>
                    )}
                  </div>
                  <input value={block.linkUrl || ""} disabled={readOnly} onChange={(e) => updateBlock(i, { linkUrl: e.target.value })} placeholder="Click-through link (optional)" className={inputCls} />
                  <input value={block.alt || ""} disabled={readOnly} onChange={(e) => updateBlock(i, { alt: e.target.value })} placeholder="Alt text (optional)" className={inputCls} />
                  {block.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={block.url} alt={block.alt || ""} className="rounded-lg max-h-40 object-contain bg-gray-50" />
                  )}
                </div>
              )}
              {block.type === "button" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={block.label || ""} disabled={readOnly} onChange={(e) => updateBlock(i, { label: e.target.value })} placeholder="Button text" className={inputCls} />
                  <input value={block.linkUrl || ""} disabled={readOnly} onChange={(e) => updateBlock(i, { linkUrl: e.target.value })} placeholder="Button link (https://… or /sponsor)" className={inputCls} />
                </div>
              )}
              {block.type === "divider" && <hr className="border-gray-200" />}
            </div>
          ))}

          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BLOCK_TYPE_LABELS) as NurtureBlockType[]).map((t) => (
                <button key={t} onClick={() => addBlock(t)} className="text-xs font-semibold border border-dashed border-gray-300 hover:border-green-500 hover:text-green-700 text-gray-600 px-3 py-2 rounded-lg">
                  + {BLOCK_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}

          {!readOnly && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => props.onSave()} disabled={busy === "save"} className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
                {busy === "save" ? "Saving…" : draft.kind === "template" ? "Save template" : "Save draft"}
              </button>
              {draft.kind === "campaign" && (
                <>
                  <button onClick={() => props.onTestSend()} disabled={busy === "test"} className="border border-gray-300 hover:border-gray-400 disabled:opacity-50 text-gray-700 font-semibold px-4 py-2.5 rounded-xl text-sm">
                    {busy === "test" ? "Sending test…" : "Send test to me"}
                  </button>
                  <button onClick={() => props.onSend()} disabled={busy === "send"} className="bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
                    {busy === "send" ? "Sending…" : `Send to ${counts[draft.audience]} businesses`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4">
          <p className={labelCls}>Preview (sample business)</p>
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-[#f3f4f6]">
            <iframe title="Email preview" srcDoc={previewHtml} className="w-full" style={{ height: 660, border: "none" }} />
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
    </div>
  );
}
