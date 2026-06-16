"use client";

import { useEffect, useState } from "react";

interface Settings {
  resend_api_key: string;
  resend_from_email: string;
  resend_from_name: string;
  spotlight_count: string;
  in_article_count: string;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  record?: string;
}

interface Domain {
  id: string;
  name: string;
  status?: string;
  records?: DnsRecord[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    resend_api_key: "",
    resend_from_email: "newsletter@thegistdecatur.com",
    resend_from_name: "The Gist Decatur",
    spotlight_count: "5",
    in_article_count: "2",
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [domain, setDomain] = useState<Domain | null>(null);
  const [domainLoading, setDomainLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [domainError, setDomainError] = useState("");

  async function loadSettings() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    setSettings((prev) => ({ ...prev, ...data.settings }));
    setHasApiKey(Boolean(data.hasApiKey));
  }

  useEffect(() => {
    loadSettings().then(() => setLoading(false));

    fetch("/api/admin/settings/domain")
      .then((r) => r.json())
      .then((data) => {
        setDomain(data.domain || null);
        setDomainLoading(false);
      });
  }, []);

  async function handleConnectDomain() {
    if (!domainInput.trim()) return;
    setConnecting(true);
    setDomainError("");
    const res = await fetch("/api/admin/settings/domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domainInput }),
    });
    const data = await res.json();
    if (res.ok) {
      setDomain(data.domain);
      setDomainInput("");
    } else {
      setDomainError(data.error || "Failed to connect domain.");
    }
    setConnecting(false);
  }

  async function handleVerifyDomain() {
    setVerifying(true);
    setDomainError("");
    const res = await fetch("/api/admin/settings/domain/verify", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setDomain(data.domain);
    } else {
      setDomainError(data.error || "Verification check failed.");
    }
    setVerifying(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    await loadSettings();
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
          Configure your Resend API integration and sending domain.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Resend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Resend</h2>
              <p className="text-xs text-gray-400">Email delivery API key</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                API Key
              </label>
              <input
                type="password"
                value={settings.resend_api_key}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, resend_api_key: e.target.value }))
                }
                placeholder="re_…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  From Email
                </label>
                <input
                  type="email"
                  value={settings.resend_from_email}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, resend_from_email: e.target.value }))
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
                  value={settings.resend_from_name}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, resend_from_name: e.target.value }))
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
                disabled={testing || !hasApiKey}
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

        {/* Sending Domain */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Sending Domain</h2>
              <p className="text-xs text-gray-400">Verify your own domain so newsletters send from your address</p>
            </div>
          </div>

          {domainLoading ? (
            <p className="text-sm text-gray-400">Loading domain status…</p>
          ) : !domain ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConnectDomain();
                    }
                  }}
                  placeholder="thegistdecatur.com"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={handleConnectDomain}
                  disabled={connecting || !hasApiKey}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  {connecting ? "Connecting…" : "Connect Domain"}
                </button>
              </div>
              {!hasApiKey && !loading && (
                <p className="text-xs text-red-500">
                  No Resend API key detected (Settings field or RESEND_API_KEY env var). Add one above to connect a domain.
                </p>
              )}
              <p className="text-xs text-gray-400">
                Enter the domain you want to send newsletters from. We&apos;ll give you DNS records to add at your registrar to verify it.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{domain.name}</p>
                  <span
                    className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      domain.status === "verified" || domain.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {domain.status || "pending"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyDomain}
                  disabled={verifying}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {verifying ? "Checking…" : "Check Verification"}
                </button>
              </div>

              {domain.records && domain.records.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Purpose</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Value</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {domain.records.map((rec, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium uppercase">{rec.record}</td>
                          <td className="px-3 py-2 font-mono">{rec.type}</td>
                          <td className="px-3 py-2 font-mono break-all">{rec.name}</td>
                          <td className="px-3 py-2 font-mono break-all">{rec.value}</td>
                          <td className="px-3 py-2">{rec.status || "pending"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(!domain.records || domain.records.length === 0) && (
                <p className="text-sm text-amber-600">
                  Resend didn&apos;t return any DNS records for this domain. See the raw response below.
                </p>
              )}

              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-600">View raw API response</summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(domain, null, 2)}
                </pre>
              </details>
              <p className="text-xs text-gray-400">
                Add these records at your domain registrar, then click Check Verification.
              </p>
            </div>
          )}

          {domainError && <p className="text-sm text-red-600 mt-3">{domainError}</p>}
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
