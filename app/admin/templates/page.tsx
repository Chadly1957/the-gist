"use client";

import { useEffect, useState } from "react";
import BlockEditor, { Block } from "@/components/admin/BlockEditor";
import { renderTemplate } from "@/lib/template-renderer";

interface Template {
  id: string;
  name: string;
  blocks: Block[];
  isDefault: boolean;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [mobileTab, setMobileTab] = useState<"list" | "editor">("list");

  async function fetchTemplates(selectAfter?: string) {
    setLoadError(false);
    try {
      const res = await fetch("/api/admin/templates");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const tpls: Template[] = (data.templates || []).map(
        (t: Template & { blocks: string }) => ({
          ...t,
          blocks: typeof t.blocks === "string" ? JSON.parse(t.blocks) : t.blocks,
        })
      );
      setTemplates(tpls);
      if (selectAfter) {
        const match = tpls.find((t) => t.id === selectAfter);
        if (match) setSelected(match);
      } else if (tpls.length > 0 && !selected) {
        setSelected(tpls.find((t) => t.isDefault) || tpls[0]);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/templates/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name,
          blocks: JSON.stringify(selected.blocks),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(name: string) {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create template.");
        return;
      }
      setShowNewForm(false);
      setNewName("");
      await fetchTemplates(data.template.id);
    } catch {
      setCreateError("Connection error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(t: Template) {
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${t.name} (Copy)`, blocks: JSON.stringify(t.blocks) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to duplicate template.");
        return;
      }
      await fetchTemplates(data.template.id);
    } catch {
      setCreateError("Connection error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  const previewHtml = selected
    ? renderTemplate(selected.blocks, [
        {
          title: "Example: City Council Approves New Park",
          description: "The Decatur City Council voted 7-0 Tuesday to approve a new community park on the east side, a project that has been in planning for two years…",
          imageUrl: null,
          articleUrl: "#",
          sourceName: "Decatur Daily",
          publishedAt: new Date(),
        },
        {
          title: "Local Restaurant Week Returns This Friday",
          description: "More than 30 Decatur restaurants will participate in this year's Restaurant Week, offering special menus and discounts for five days starting Friday…",
          imageUrl: null,
          articleUrl: "#",
          sourceName: "AL.com",
          publishedAt: new Date(),
        },
      ])
    : "";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading templates…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-3">Could not load templates.</p>
          <button
            onClick={() => { setLoading(true); fetchTemplates(); }}
            className="text-sm text-green-700 font-medium hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Mobile tab bar */}
      <div className="flex border-b border-gray-200 bg-white shrink-0 md:hidden">
        <button
          onClick={() => setMobileTab("list")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileTab === "list" ? "text-green-700 border-b-2 border-green-700" : "text-gray-500"}`}
        >
          Templates
        </button>
        <button
          onClick={() => setMobileTab("editor")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileTab === "editor" ? "text-green-700 border-b-2 border-green-700" : "text-gray-500"}`}
        >
          Editor
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className={`${mobileTab === "list" ? "flex" : "hidden"} md:flex w-full md:w-52 border-r border-gray-200 bg-white flex-col md:shrink-0`}>
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">Templates</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 px-4 py-2.5 text-sm transition-colors ${
                selected?.id === t.id
                  ? "bg-green-50 text-green-800 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <button
                onClick={() => setSelected({ ...t })}
                className="flex-1 min-w-0 text-left"
              >
                <span className="block truncate">{t.name}</span>
                {t.isDefault && (
                  <span className="text-xs text-green-600 font-normal">Default</span>
                )}
              </button>
              <button
                onClick={() => handleDuplicate(t)}
                disabled={creating}
                title="Duplicate template"
                className="shrink-0 p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-green-700 transition-opacity disabled:opacity-30"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* New template form */}
        <div className="p-3 border-t border-gray-100">
          {showNewForm ? (
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate(newName);
                  if (e.key === "Escape") { setShowNewForm(false); setNewName(""); setCreateError(""); }
                }}
                placeholder="Template name…"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              {createError && (
                <p className="text-xs text-red-500">{createError}</p>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => handleCreate(newName)}
                  disabled={creating || !newName.trim()}
                  className="flex-1 text-xs bg-green-700 text-white py-1.5 rounded-lg font-medium disabled:opacity-50 hover:bg-green-800 transition-colors"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => { setShowNewForm(false); setNewName(""); setCreateError(""); }}
                  className="flex-1 text-xs text-gray-500 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full text-xs text-gray-500 hover:text-green-700 py-1.5 border border-dashed border-gray-200 rounded-lg hover:border-green-300 transition-colors"
            >
              + New template
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className={`${mobileTab === "editor" ? "flex" : "hidden"} md:flex flex-1 flex-col overflow-hidden`}>
      {!selected && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">No templates yet</h3>
            <p className="text-sm text-gray-400 mb-5">Create your first template to get started.</p>
            <button
              onClick={() => handleCreate("Default Newsletter")}
              disabled={creating}
              className="bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create Default Template"}
            </button>
            {createError && <p className="text-sm text-red-500 mt-3">{createError}</p>}
          </div>
        </div>
      )}

      {selected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
            <input
              value={selected.name}
              onChange={(e) =>
                setSelected((s) => s ? { ...s, name: e.target.value } : s)
              }
              className="font-semibold text-gray-800 text-sm bg-transparent border-0 focus:outline-none focus:border-b-2 focus:border-green-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreview(!preview)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  preview
                    ? "bg-gray-900 text-white border-gray-900"
                    : "text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {preview ? "Edit" : "Preview"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-700 hover:bg-green-800 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && (
                <span className="text-green-600 text-sm font-medium">Saved!</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {preview ? (
              <div className="p-6">
                <div className="max-w-[600px] mx-auto shadow-lg rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full"
                    style={{ height: "800px", border: "none" }}
                    title="Email preview"
                  />
                </div>
                <p className="text-center text-xs text-gray-400 mt-3">
                  Preview uses sample articles. Actual articles will be inserted when composing.
                </p>
              </div>
            ) : (
              <div className="p-6 max-w-2xl">
                <BlockEditor
                  blocks={selected.blocks}
                  onChange={(blocks) =>
                    setSelected((s) => s ? { ...s, blocks } : s)
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
