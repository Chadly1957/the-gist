"use client";

import { useEffect, useState } from "react";
import UrlInput from "@/components/UrlInput";

interface Source {
  id: string;
  name: string;
  url: string;
  active: boolean;
  keywords: string;
  createdAt: string;
  clickCount: number;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  // Per-source keyword editing: { [id]: draft value } — key present means editing
  const [editingKw, setEditingKw] = useState<Record<string, string>>({});

  async function fetchSources() {
    const res = await fetch("/api/admin/sources");
    const data = await res.json();
    setSources(data.sources || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchSources();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, keywords: keywords.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setName("");
      setUrl("");
      setKeywords("");
      fetchSources();
    } else {
      setError(data.error || "Failed to add source.");
    }
    setAdding(false);
  }

  async function toggleSource(id: string, active: boolean) {
    await fetch(`/api/admin/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    fetchSources();
  }

  async function deleteSource(id: string) {
    if (!confirm("Remove this source?")) return;
    await fetch(`/api/admin/sources/${id}`, { method: "DELETE" });
    fetchSources();
  }

  function startEditKw(source: Source) {
    setEditingKw((prev) => ({ ...prev, [source.id]: source.keywords }));
  }

  function cancelEditKw(id: string) {
    setEditingKw((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveKeywords(id: string) {
    const value = editingKw[id] ?? "";
    await fetch(`/api/admin/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: value }),
    });
    cancelEditKw(id);
    fetchSources();
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage the URLs the scraper pulls articles from. Works with RSS feeds, Substack, news sites, and more.
        </p>
      </div>

      {/* Add source form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add a Source</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Source name (e.g. Decatur Daily)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <UrlInput
              placeholder="https://example.com or https://example.substack.com/feed"
              value={url}
              onChange={(val) => setUrl(val)}
              required
              className="flex-[2] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="bg-green-700 hover:bg-green-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 shrink-0"
            >
              {adding ? "Adding…" : "Add Source"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Keyword filter — optional (e.g. decatur,dekalb)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 shrink-0 max-w-48">
              Only keep articles containing one of these comma-separated words
            </p>
          </div>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-700 font-medium">Tips for adding sources:</p>
          <ul className="text-xs text-blue-600 mt-1 space-y-0.5 list-disc list-inside">
            <li>Substack newsletters: use the homepage URL, RSS is auto-detected</li>
            <li>News sites: paste the homepage or a section URL (e.g. /local-news)</li>
            <li>Direct RSS feeds: paste the feed URL directly (e.g. /feed.xml)</li>
            <li>Use the keyword filter on sources that mix national news to keep only local stories</li>
          </ul>
        </div>
      </div>

      {/* Sources list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Your Sources ({sources.filter((s) => s.active).length} active)
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No sources yet. Add one above to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">URL</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Keyword Filter</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Views</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => {
                  const isEditingKw = source.id in editingKw;
                  const kwList = source.keywords
                    ? source.keywords.split(",").map((k) => k.trim()).filter(Boolean)
                    : [];
                  return (
                    <tr key={source.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {source.name}
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs font-mono truncate max-w-xs block"
                        >
                          {source.url}
                        </a>
                      </td>
                      <td className="px-5 py-3 min-w-[180px]">
                        {isEditingKw ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingKw[source.id]}
                              onChange={(e) =>
                                setEditingKw((prev) => ({ ...prev, [source.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveKeywords(source.id);
                                if (e.key === "Escape") cancelEditKw(source.id);
                              }}
                              placeholder="decatur,dekalb"
                              autoFocus
                              className="w-36 px-2 py-1 border border-green-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                            <button
                              onClick={() => saveKeywords(source.id)}
                              className="text-xs font-semibold text-green-700 hover:text-green-800"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => cancelEditKw(source.id)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditKw(source)}
                            className="group flex items-center gap-1.5 text-left"
                            title="Click to edit keyword filter"
                          >
                            {kwList.length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {kwList.map((kw) => (
                                  <span
                                    key={kw}
                                    className="bg-green-50 text-green-700 text-xs px-1.5 py-0.5 rounded font-medium"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 group-hover:text-gray-500">
                                No filter
                              </span>
                            )}
                            <svg
                              className="w-3 h-3 text-gray-300 group-hover:text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleSource(source.id, source.active)}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                            source.active
                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${source.active ? "bg-green-500" : "bg-gray-400"}`}
                          />
                          {source.active ? "Active" : "Paused"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800">
                        {source.clickCount > 0 ? source.clickCount.toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deleteSource(source.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove source"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
