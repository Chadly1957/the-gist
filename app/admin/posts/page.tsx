"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";

interface Article {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  articleUrl: string;
  sourceName: string;
  publishedAt: string;
}

type Format = "square" | "landscape";

const GREEN = "#166534";
const PREVIEW_W = 460;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function CardPreview({
  format,
  headline,
  excerpt,
  source,
  date,
  imageUrl,
  cta,
}: {
  format: Format;
  headline: string;
  excerpt: string;
  source: string;
  date: string;
  imageUrl: string;
  cta: string;
}) {
  const imgW = format === "landscape" ? 1200 : 1080;
  const imgH = format === "landscape" ? 630 : 1080;
  const scale = PREVIEW_W / imgW;
  const previewH = Math.round(imgH * scale);

  const sourceDateRow = (fontSize: number, gap: number) =>
    (source || date) ? (
      <div style={{ display: "flex", gap, alignItems: "center", marginBottom: Math.round(14 * scale) }}>
        {source && (
          <span style={{ color: GREEN, fontWeight: 700, fontSize, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            {source}
          </span>
        )}
        {source && date && <span style={{ color: "#9ca3af", fontSize }}>•</span>}
        {date && <span style={{ color: "#9ca3af", fontSize }}>{date}</span>}
      </div>
    ) : null;

  const ctaEl = (fontSize: number, py: number, px: number) =>
    cta ? (
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: Math.round(20 * scale) }}>
        <div style={{ background: GREEN, color: "white", padding: `${py}px ${px}px`, borderRadius: 999, fontSize, fontWeight: 700 }}>
          {cta}
        </div>
      </div>
    ) : null;

  if (format === "landscape") {
    const leftW = Math.round(560 * scale);
    const rightW = PREVIEW_W - leftW;
    return (
      <div style={{ width: PREVIEW_W, height: previewH, overflow: "hidden", background: "white", display: "flex", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        {/* Left: image */}
        <div style={{ width: leftW, flexShrink: 0, overflow: "hidden" }}>
          {imageUrl ? (
            <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#9ca3af", fontSize: 13 }}>No image</span>
            </div>
          )}
        </div>
        {/* Right: content */}
        <div style={{ width: rightW, display: "flex", flexDirection: "column", padding: Math.round(44 * scale) }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: Math.round(24 * scale) }}>
            <Logo className="h-5 w-auto" />
          </div>
          <div style={{ height: 2, background: GREEN, marginBottom: Math.round(20 * scale), borderRadius: 2 }} />
          {sourceDateRow(Math.round(13 * scale), Math.round(8 * scale))}
          <div style={{ fontSize: Math.round(26 * scale), fontWeight: 800, color: "#111827", lineHeight: 1.25, marginBottom: Math.round(12 * scale) }}>
            {headline}
          </div>
          {excerpt && (
            <div style={{ fontSize: Math.round(15 * scale), color: "#6b7280", lineHeight: 1.6, flex: 1, overflow: "hidden" }}>
              {excerpt}
            </div>
          )}
          {ctaEl(Math.round(14 * scale), Math.round(10 * scale), Math.round(22 * scale))}
        </div>
      </div>
    );
  }

  // Square
  const bottomPad = Math.round(36 * scale);
  return (
    <div style={{ width: PREVIEW_W, height: previewH, overflow: "hidden", background: "white", display: "flex", flexDirection: "column", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: `${Math.round(26 * scale)}px ${Math.round(56 * scale)}px`, borderBottom: `${Math.max(1, Math.round(4 * scale))}px solid ${GREEN}` }}>
        <Logo className="h-5 w-auto" />
      </div>
      {/* Image */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>No image</span>
          </div>
        )}
      </div>
      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", padding: `${Math.round(28 * scale)}px ${Math.round(44 * scale)}px ${bottomPad}px` }}>
        {sourceDateRow(Math.round(16 * scale), Math.round(10 * scale))}
        <div style={{ fontSize: Math.round(34 * scale), fontWeight: 800, color: "#111827", lineHeight: 1.2, marginBottom: Math.round(12 * scale) }}>
          {headline}
        </div>
        {excerpt && (
          <div style={{ fontSize: Math.round(18 * scale), color: "#6b7280", lineHeight: 1.55, marginBottom: Math.round(16 * scale) }}>
            {excerpt}
          </div>
        )}
        {ctaEl(Math.round(16 * scale), Math.round(12 * scale), Math.round(28 * scale))}
      </div>
    </div>
  );
}

export default function PostsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);
  const [format, setFormat] = useState<Format>("square");
  const [headline, setHeadline] = useState("");
  const [excerptLen, setExcerptLen] = useState(150);
  const [cta, setCta] = useState("Read More →");
  const [downloading, setDownloading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"articles" | "editor">("articles");

  useEffect(() => {
    fetch("/api/admin/articles")
      .then((r) => r.json())
      .then((d) => setArticles(d.articles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function selectArticle(article: Article) {
    setSelected(article);
    setHeadline(article.title);
    setMobileTab("editor");
  }

  const excerpt = selected
    ? (selected.description || "").slice(0, excerptLen)
    : "";

  const filteredArticles = articles.filter((a) =>
    search.trim()
      ? a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.sourceName.toLowerCase().includes(search.toLowerCase())
      : true
  );

  async function downloadImage() {
    if (!selected) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        headline,
        excerpt,
        source: selected.sourceName,
        date: formatDate(selected.publishedAt),
        imageUrl: selected.imageUrl || "",
        cta,
        format,
      });
      const res = await fetch(`/api/admin/posts/image?${params}`);
      if (!res.ok) throw new Error("Failed to generate image");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `post-${format}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const articleList = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search articles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-400">Loading articles…</div>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-400">No articles found.</div>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <button
              key={article.id}
              onClick={() => selectArticle(article)}
              className={`w-full text-left flex gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selected?.id === article.id ? "bg-green-50 border-l-2 border-l-green-700" : ""
              }`}
            >
              <div className="w-16 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                  {article.title}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {article.sourceName} · {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const editor = (
    <div className="flex-1 overflow-y-auto p-6">
      {!selected ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg className="w-12 h-12 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-400 font-medium">Select an article to get started</p>
          <p className="text-xs text-gray-300 mt-1">Choose an article from the list on the left</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* Format selector */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm font-medium text-gray-700">Format:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setFormat("square")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  format === "square"
                    ? "bg-green-700 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Square 1080×1080
              </button>
              <button
                onClick={() => setFormat("landscape")}
                className={`px-4 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${
                  format === "landscape"
                    ? "bg-green-700 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Landscape 1200×630
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Edit controls */}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Headline</label>
                <textarea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Excerpt length</label>
                  <span className="text-xs text-gray-500 font-medium">{excerptLen} chars</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={10}
                  value={excerptLen}
                  onChange={(e) => setExcerptLen(Number(e.target.value))}
                  className="w-full accent-green-700"
                />
                {excerptLen > 0 && (
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                    {excerpt || <span className="italic text-gray-400">No description available</span>}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Call to action</label>
                <input
                  type="text"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="e.g. Read More →"
                />
              </div>

              <button
                onClick={downloadImage}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {downloading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                  </>
                )}
              </button>
            </div>

            {/* Preview */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Preview</p>
              <CardPreview
                format={format}
                headline={headline}
                excerpt={excerptLen > 0 ? excerpt : ""}
                source={selected.sourceName}
                date={formatDate(selected.publishedAt)}
                imageUrl={selected.imageUrl || ""}
                cta={cta}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile tab bar */}
      <div className="fixed top-14 inset-x-0 z-10 flex border-b border-gray-200 bg-white md:hidden">
        <button
          onClick={() => setMobileTab("articles")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === "articles"
              ? "text-green-700 border-b-2 border-green-700"
              : "text-gray-500"
          }`}
        >
          Articles
        </button>
        <button
          onClick={() => setMobileTab("editor")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === "editor"
              ? "text-green-700 border-b-2 border-green-700"
              : "text-gray-500"
          }`}
        >
          Editor
        </button>
      </div>

      {/* Desktop left: article list */}
      <div className="hidden md:flex w-72 flex-col border-r border-gray-200 bg-white flex-shrink-0 h-full">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Articles</h2>
        </div>
        {articleList}
      </div>

      {/* Mobile panels */}
      <div className={`md:hidden flex-1 mt-9 overflow-hidden ${mobileTab === "articles" ? "flex flex-col" : "hidden"}`}>
        {articleList}
      </div>
      <div className={`md:hidden flex-1 mt-9 overflow-hidden ${mobileTab === "editor" ? "flex flex-col" : "hidden"}`}>
        {editor}
      </div>

      {/* Desktop right: editor */}
      <div className="hidden md:flex flex-col flex-1 h-full bg-gray-50">
        <div className="px-6 py-3 border-b border-gray-200 bg-white">
          <h1 className="text-sm font-semibold text-gray-700">
            Posts
            {selected && (
              <span className="ml-2 text-gray-400 font-normal">— {selected.sourceName}</span>
            )}
          </h1>
        </div>
        {editor}
      </div>
    </div>
  );
}
