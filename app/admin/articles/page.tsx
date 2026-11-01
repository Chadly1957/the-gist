"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { workspaceFetch, workspacePath } from "@/lib/workspace-client";
import Link from "@/components/workspace/WorkspaceLink";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), { ssr: false });

interface Story {
  id: string;
  headline: string;
  slug: string;
  author: string;
  headerImageUrl: string | null;
  body: string;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  viewCount: number;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
}

const EMPTY_FORM = {
  headline: "",
  slug: "",
  author: "Chad Williams",
  headerImageUrl: "",
  body: "",
  excerpt: "",
  seoTitle: "",
  seoDescription: "",
  status: "draft",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function ArticlesPage() {
  const [list, setList] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const heroInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await workspaceFetch("/api/admin/stories");
      const data = await res.json();
      setList(data.stories || []);
    } catch {
      setError("Failed to load articles.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await workspaceFetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    return data.url as string;
  };

  const onHeroPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      if (url) setForm((f) => ({ ...f, headerImageUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setUploading(false);
    e.target.value = "";
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const openEdit = (s: Story) => {
    setEditingId(s.id);
    setForm({
      headline: s.headline,
      slug: s.slug,
      author: s.author,
      headerImageUrl: s.headerImageUrl || "",
      body: s.body,
      excerpt: s.excerpt || "",
      seoTitle: s.seoTitle || "",
      seoDescription: s.seoDescription || "",
      status: s.status,
    });
    setSlugTouched(true);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const payload = {
      headline: form.headline,
      slug: form.slug || undefined,
      author: form.author,
      headerImageUrl: form.headerImageUrl || null,
      body: form.body,
      excerpt: form.excerpt,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      status: form.status,
    };
    try {
      const url = editingId ? `/api/admin/stories/${editingId}` : "/api/admin/stories";
      const res = await workspaceFetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSuccess(
        editingId
          ? "Article updated."
          : `Article created${data.story.status === "published" ? ` and live at /articles/${data.story.slug}` : " as a draft"}.`
      );
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
    setSaving(false);
  };

  const setStatus = async (s: Story, status: string) => {
    try {
      const res = await workspaceFetch(`/api/admin/stories/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status change failed.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed.");
    }
  };

  const feedPath = workspacePath("/articles/feed.xml");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Original articles published on this site at /articles. To pull them into newsletter
            issues, add this workspace&apos;s feed as a Source: <span className="font-mono text-gray-700">{feedPath}</span>
          </p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          + New Article
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={submit} className="mb-8 p-5 border rounded-xl bg-gray-50 space-y-4">
          <h2 className="font-semibold">{editingId ? "Edit article" : "New article"}</h2>
          <label className="block">
            <span className="text-sm font-medium">Headline</span>
            <input
              required
              value={form.headline}
              onChange={(e) => {
                const headline = e.target.value;
                setForm((f) => ({ ...f, headline, slug: slugTouched ? f.slug : slugify(headline) }));
              }}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              placeholder="What Decatur drivers need to know about the Route 51 project"
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Author</span>
              <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">URL slug</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: e.target.value });
                }}
                className="mt-1 w-full border rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="auto from headline"
              />
              <span className="text-xs text-gray-400">The article lives at /articles/&lt;this slug&gt;.</span>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium">Header image</span>
            <div className="mt-1 flex items-center gap-3">
              {form.headerImageUrl && <img src={form.headerImageUrl} alt="" className="w-20 h-20 object-cover rounded-lg border" />}
              <button type="button" onClick={() => heroInput.current?.click()} disabled={uploading} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 bg-white">
                {uploading ? "Uploading..." : form.headerImageUrl ? "Replace header image" : "Upload header image"}
              </button>
              {form.headerImageUrl && <button type="button" onClick={() => setForm({ ...form, headerImageUrl: "" })} className="text-sm text-red-600">Remove</button>}
              <input ref={heroInput} type="file" accept="image/*" className="hidden" onChange={onHeroPick} />
            </div>
            <input value={form.headerImageUrl} onChange={(e) => setForm({ ...form, headerImageUrl: e.target.value })} className="mt-2 w-full border rounded-lg px-3 py-2 text-sm" placeholder="...or paste an image URL" />
          </div>

          <div>
            <span className="text-sm font-medium">Body</span>
            <div className="mt-1">
              <RichTextEditor
                key={editingId || "new"}
                initialHtml={form.body}
                onChange={(html) => setForm((f) => ({ ...f, body: html }))}
              />
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Excerpt (optional)</span>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              rows={2}
              placeholder="One or two sentences. Used on the /articles page, in search/social previews, and in the newsletter source list. Left blank, it is pulled from the start of the article."
            />
          </label>

          <details className="border rounded-lg bg-white px-4 py-3">
            <summary className="text-sm font-medium cursor-pointer">Search &amp; social (optional)</summary>
            <div className="mt-3 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Search title</span>
                <input
                  value={form.seoTitle}
                  onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Blank = the headline is used"
                />
                <span className="text-xs text-gray-400">Only changes what Google and social shares show, not the headline on the page.</span>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Search description</span>
                <textarea
                  value={form.seoDescription}
                  onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Blank = the excerpt (or the article's opening lines) is used"
                />
              </label>
            </div>
          </details>

          <div className="flex items-end gap-4 flex-wrap">
            <label className="block">
              <span className="text-sm font-medium">Status</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 border rounded-lg px-3 py-2">
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published (live)</option>
              </select>
            </label>
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Save changes" : "Create article"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border rounded-lg bg-white">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : list.length === 0 ? (
        <p className="text-gray-500">No articles yet. The first original could live here.</p>
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.id} className="border rounded-xl p-4 flex items-center gap-4 bg-white">
              {s.headerImageUrl ? <img src={s.headerImageUrl} alt="" className="w-14 h-14 object-cover rounded-lg border" /> : <div className="w-14 h-14 rounded-lg border bg-gray-50" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{s.headline}</div>
                <div className="text-sm text-gray-500 truncate">
                  by {s.author} · /articles/{s.slug}
                  {s.publishedAt && <> · published {new Date(s.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
                  {typeof s.viewCount === "number" && <> · {s.viewCount.toLocaleString()} views</>}
                </div>
                {s.excerpt && <div className="text-sm text-gray-400 truncate">{s.excerpt}</div>}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[s.status] || "bg-gray-100"}`}>{s.status}</span>
              {s.status === "published" ? (
                <>
                  <Link href={`/articles/${s.slug}`} className="text-sm text-blue-600 hover:underline">View</Link>
                  <button onClick={() => setStatus(s, "draft")} className="text-sm text-gray-500 hover:underline">Unpublish</button>
                </>
              ) : (
                <button onClick={() => setStatus(s, "published")} className="text-sm text-green-700 hover:underline">Publish</button>
              )}
              <button onClick={() => openEdit(s)} className="text-sm text-blue-600 hover:underline">Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
