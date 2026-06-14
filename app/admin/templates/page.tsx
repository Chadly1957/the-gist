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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  async function fetchTemplates() {
    try {
      const res = await fetch("/api/admin/templates");
      const data = await res.json();
      const tpls: Template[] = (data.templates || []).map(
        (t: Template & { blocks: string }) => ({
          ...t,
          blocks: typeof t.blocks === "string" ? JSON.parse(t.blocks) : t.blocks,
        })
      );
      setTemplates(tpls);
      if (tpls.length > 0 && !selected) {
        setSelected(tpls.find((t) => t.isDefault) || tpls[0]);
      }
    } catch {
      // leave templates empty, show empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/admin/templates/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selected.name,
        blocks: JSON.stringify(selected.blocks),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function createTemplate(name?: string) {
    const templateName = name || prompt("Template name:");
    if (!templateName) return;
    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName }),
    });
    const data = await res.json();
    await fetchTemplates();
    setSelected({
      ...data.template,
      blocks: JSON.parse(data.template.blocks),
    });
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
    return <div className="p-8 text-gray-400 text-sm">Loading templates…</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: template list */}
      <div className="w-52 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">Templates</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected({ ...t })}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selected?.id === t.id
                  ? "bg-green-50 text-green-800 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="block truncate">{t.name}</span>
              {t.isDefault && (
                <span className="text-xs text-green-600 font-normal">Default</span>
              )}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={createTemplate}
            className="w-full text-xs text-gray-500 hover:text-green-700 py-1.5 border border-dashed border-gray-200 rounded-lg hover:border-green-300 transition-colors"
          >
            + New template
          </button>
        </div>
      </div>

      {/* Main: block editor */}
      {!selected && !loading && (
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
              onClick={() => createTemplate("Default Newsletter")}
              className="bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Create Default Template
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <input
                value={selected.name}
                onChange={(e) =>
                  setSelected((s) => s ? { ...s, name: e.target.value } : s)
                }
                className="font-semibold text-gray-800 text-sm bg-transparent border-0 focus:outline-none focus:border-b-2 focus:border-green-500"
              />
            </div>
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
  );
}
