"use client";

import { useEffect, useState } from "react";
import { renderTemplate } from "@/lib/template-renderer";

interface Article {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  articleUrl: string;
  sourceName: string;
  publishedAt: string;
  selected: boolean;
}

interface Template {
  id: string;
  name: string;
  blocks: string;
  isDefault: boolean;
}

export default function ComposePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState(
    `The Gist Decatur: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`
  );
  const [blurb, setBlurb] = useState("");
  const [newsletterDate, setNewsletterDate] = useState(new Date().toISOString().split("T")[0]);
  const [scraping, setScraping] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [scrapeError, setScrapeError] = useState("");
  const [showTestForm, setShowTestForm] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    // Load templates
    fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        const def = (data.templates || []).find((t: Template) => t.isDefault);
        if (def) setSelectedTemplateId(def.id);
      });
    // Load already-scraped articles
    fetch("/api/admin/articles")
      .then((r) => r.json())
      .then((data) => setArticles(data.articles || []));
  }, []);

  async function handleScrape() {
    setScraping(true);
    setScrapeError("");
    const res = await fetch("/api/admin/scrape", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setArticles(data.articles || []);
    } else {
      setScrapeError(data.error || "Scrape failed.");
    }
    setScraping(false);
  }

  function toggleArticle(id: string) {
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
    );
  }

  function selectAll() {
    setArticles((prev) => prev.map((a) => ({ ...a, selected: true })));
  }

  function deselectAll() {
    setArticles((prev) => prev.map((a) => ({ ...a, selected: false })));
  }

  const selectedArticles = articles.filter((a) => a.selected);

  function buildPreviewHtml() {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return "";
    let blocks = JSON.parse(tmpl.blocks);

    // Inject blurb into text blocks if provided
    if (blurb) {
      blocks = blocks.map((b: { type: string; content: Record<string, string> }) =>
        b.type === "text" && blocks.indexOf(b) === blocks.findIndex((x: { type: string }) => x.type === "text")
          ? { ...b, content: { ...b.content, html: `${b.content.html}<p>${blurb}</p>` } }
          : b
      );
    }

    return renderTemplate(
      blocks,
      selectedArticles.map((a) => ({
        ...a,
        publishedAt: new Date(a.publishedAt),
      }))
    );
  }

  async function handleSend() {
    if (selectedArticles.length === 0) {
      alert("Select at least one article before sending.");
      return;
    }
    if (!selectedTemplateId) {
      alert("Please select a template.");
      return;
    }

    setSending(true);
    setSendResult(null);

    const res = await fetch("/api/admin/newsletter/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        templateId: selectedTemplateId,
        articleIds: selectedArticles.map((a) => a.id),
        blurb,
        newsletterDate,
      }),
    });
    const data = await res.json();
    setSendResult({ ok: res.ok, message: data.message || data.error || "Unknown error" });
    setSending(false);
  }

  async function handleTestSend() {
    if (!testEmail) return;
    if (selectedArticles.length === 0) {
      setSendResult({ ok: false, message: "Select at least one article before sending a test." });
      return;
    }
    setTestSending(true);
    setSendResult(null);
    const res = await fetch("/api/admin/newsletter/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testEmail,
        subject,
        templateId: selectedTemplateId,
        articleIds: selectedArticles.map((a) => a.id),
        blurb,
        newsletterDate,
      }),
    });
    const data = await res.json();
    setSendResult({ ok: res.ok, message: data.message || data.error || "Unknown error" });
    setTestSending(false);
    if (res.ok) setShowTestForm(false);
  }

  const previewHtml = preview ? buildPreviewHtml() : "";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel: Article selection */}
      <div className="w-[420px] flex flex-col border-r border-gray-200 bg-white shrink-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Article Pool</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Select articles to include in today's issue
          </p>
        </div>

        {/* Scrape button */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {scraping ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scraping…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Fetch Latest Articles
              </>
            )}
          </button>
          {articles.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={selectAll} className="text-xs text-gray-400 hover:text-gray-700">All</button>
              <span className="text-gray-200">|</span>
              <button onClick={deselectAll} className="text-xs text-gray-400 hover:text-gray-700">None</button>
            </div>
          )}
        </div>

        {scrapeError && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-100">
            <p className="text-xs text-red-500">{scrapeError}</p>
          </div>
        )}

        {/* Article list */}
        <div className="flex-1 overflow-y-auto">
          {articles.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <p className="text-sm font-medium">No articles yet</p>
              <p className="text-xs mt-1">Click "Fetch Latest Articles" to scrape your sources</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {articles.map((article) => (
                <label
                  key={article.id}
                  className={`flex gap-3 p-4 cursor-pointer transition-colors ${
                    article.selected ? "bg-green-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={article.selected}
                      onChange={() => toggleArticle(article.id)}
                      className="w-4 h-4 accent-green-700 rounded"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {article.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={article.imageUrl}
                        alt=""
                        className="w-full h-28 object-cover rounded-lg mb-2"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">
                      {article.sourceName}
                    </p>
                    <p className="text-sm font-semibold text-gray-800 leading-snug mb-1">
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                      {article.description}
                    </p>
                    <p className="text-xs text-gray-300 mt-1.5">
                      {new Date(article.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Selection count */}
        {articles.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{selectedArticles.length}</span> of {articles.length} articles selected
            </p>
          </div>
        )}
      </div>

      {/* Right panel: Compose & preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between px-6 py-3 gap-4">
            <h2 className="text-base font-bold text-gray-900 shrink-0">Compose Issue</h2>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setPreview(!preview)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  preview
                    ? "bg-gray-900 text-white border-gray-900"
                    : "text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {preview ? "Edit" : "Preview Email"}
              </button>
              <button
                onClick={() => { setShowTestForm((v) => !v); setSendResult(null); }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Send Test
              </button>
              <button
                onClick={handleSend}
                disabled={sending || selectedArticles.length === 0}
                className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {sending ? "Sending…" : "Send to List"}
              </button>
            </div>
          </div>

          {/* Inline test send form */}
          {showTestForm && (
            <div className="px-6 pb-3 flex items-center gap-2 border-t border-gray-100 pt-3">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 max-w-xs px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                onKeyDown={(e) => e.key === "Enter" && handleTestSend()}
              />
              <button
                onClick={handleTestSend}
                disabled={testSending || !testEmail}
                className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {testSending ? "Sending…" : "Send Test Email"}
              </button>
              <p className="text-xs text-gray-400">Sends only to this address · subject prefixed with [TEST]</p>
            </div>
          )}
        </div>

        {sendResult && (
          <div
            className={`px-6 py-3 text-sm font-medium border-b ${
              sendResult.ok
                ? "bg-green-50 text-green-700 border-green-100"
                : "bg-red-50 text-red-700 border-red-100"
            }`}
          >
            {sendResult.message}
          </div>
        )}

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
            </div>
          ) : (
            <div className="p-6 max-w-2xl space-y-5">
              {/* Newsletter date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Newsletter Date
                </label>
                <input
                  type="date"
                  value={newsletterDate}
                  onChange={(e) => setNewsletterDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">Used to load sponsors booked for this date.</p>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Template */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional blurb */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Optional Intro Blurb
                </label>
                <textarea
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  rows={3}
                  placeholder="Add a personal note for today's issue… (optional, appended to the first text block)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              {/* Selected articles preview */}
              {selectedArticles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    {selectedArticles.length} Articles Queued
                  </p>
                  <div className="space-y-2">
                    {selectedArticles.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <button
                          onClick={() => toggleArticle(a.id)}
                          className="mt-0.5 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <div>
                          <p className="text-xs font-semibold text-green-700">{a.sourceName}</p>
                          <p className="text-sm font-medium text-gray-700 leading-snug">{a.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedArticles.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center text-gray-400">
                  <p className="text-sm">No articles selected yet.</p>
                  <p className="text-xs mt-1">
                    Fetch &amp; select articles from the left panel.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
