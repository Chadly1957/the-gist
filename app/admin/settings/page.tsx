"use client";

import { useEffect, useState } from "react";

interface Settings {
  unosend_api_key: string;
  unosend_list_id: string;
  unosend_from_email: string;
  unosend_from_name: string;
  spotlight_count: string;
  in_article_count: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    unosend_api_key: "",
    unosend_list_id: "",
    unosend_from_email: "newsletter@thegistdecatur.com",
    unosend_from_name: "The Gist Decatur",
    spotlight_count: "5",
    in_article_count: "2",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data.settings }));
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/admin/settings/test", { method: "POST" });
    const data = await res.json();
    setTestResult({ ok: res.ok, message: data.message });
    setTesting(false);
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-400 text-sm">Loading settings…</div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure your Unosend API integration for list management and sending.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Unosend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Unosend</h2>
              <p className="text-xs text-gray-400">Email delivery &amp; list management</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                API Key
              </label>
              <input
                type="password"
                value={settings.unosend_api_key}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, unosend_api_key: e.target.value }))
                }
                placeholder="sk_live_…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                List ID
              </label>
              <input
                type="text"
                value={settings.unosend_list_id}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, unosend_list_id: e.target.value }))
                }
                placeholder="list_abc123"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                The Unosend list ID to send newsletters to and add new subscribers to.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  From Email
                </label>
                <input
                  type="email"
                  value={settings.unosend_from_email}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, unosend_from_email: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  From Name
                </label>
                <input
                  type="text"
                  value={settings.unosend_from_name}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, unosend_from_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Test connection */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !settings.unosend_api_key}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test Connection"}
              </button>
              {testResult && (
                <span
                  className={`text-sm font-medium ${testResult.ok ? "text-green-600" : "text-red-500"}`}
                >
                  {testResult.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Newsletter Limits */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Newsletter Limits</h2>
              <p className="text-xs text-gray-400">Control how many sponsor slots appear per newsletter</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Spotlight businesses per issue
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.spotlight_count}
                onChange={(e) => setSettings((s) => ({ ...s, spotlight_count: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Rotating businesses shown in each newsletter (default: 5)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                In-article ads per issue
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.in_article_count}
                onChange={(e) => setSettings((s) => ({ ...s, in_article_count: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Max in-article ads woven into the newsletter (default: 2)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 hover:bg-green-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && (
            <span className="text-green-600 text-sm font-medium">Settings saved!</span>
          )}
        </div>
      </form>
    </div>
  );
}
