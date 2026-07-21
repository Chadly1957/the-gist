"use client";

import { useEffect, useState } from "react";

type EmailProvider = "resend" | "unosend" | "smtp";

interface Settings {
  email_provider: EmailProvider | "";
  resend_api_key: string;
  resend_from_email: string;
  resend_from_name: string;
  unosend_api_key: string;
  unosend_from_email: string;
  unosend_from_name: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  smtp_from_name: string;
  spotlight_count: string;
  in_article_count: string;
  sponsorship_price_spotlight: string;
  sponsorship_price_in_article: string;
  sponsorship_price_presenting: string;
  sponsorship_price_wordy: string;
  stripe_price_in_article_cents: string;
  stripe_price_presenting_cents: string;
  stripe_price_wordy_cents: string;
}

const PROVIDERS = [
  {
    label: "Brevo",
    description: "300 emails/day free",
    host: "smtp-relay.brevo.com",
    port: "587",
  },
  {
    label: "AWS SES",
    description: "$0.10 per 1,000 emails",
    host: "email-smtp.us-east-1.amazonaws.com",
    port: "587",
  },
  {
    label: "Gmail",
    description: "Use an App Password",
    host: "smtp.gmail.com",
    port: "587",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    email_provider: "",
    resend_api_key: "",
    resend_from_email: "newsletter@thegistdecatur.com",
    resend_from_name: "The Gist Decatur",
    unosend_api_key: "",
    unosend_from_email: "newsletter@thegistdecatur.com",
    unosend_from_name: "The Gist Decatur",
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "newsletter@thegistdecatur.com",
    smtp_from_name: "The Gist Decatur",
    spotlight_count: "5",
    in_article_count: "2",
    sponsorship_price_spotlight: "Free",
    sponsorship_price_in_article: "$15/day",
    sponsorship_price_presenting: "$25/day",
    sponsorship_price_wordy: "$20/day",
    stripe_price_in_article_cents: "1500",
    stripe_price_presenting_cents: "2500",
    stripe_price_wordy_cents: "2000",
  });
  const [hasSmtp, setHasSmtp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function loadSettings() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    setSettings((prev) => ({ ...prev, ...data.settings }));
    setHasSmtp(Boolean(data.hasSmtp));
  }

  useEffect(() => {
    loadSettings().then(() => setLoading(false));
  }, []);

  function applyPreset(preset: (typeof PROVIDERS)[number]) {
    setSettings((s) => ({ ...s, smtp_host: preset.host, smtp_port: preset.port }));
    setTestResult(null);
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
    const res = await fetch("/api/admin/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json();
    setTestResult({ ok: res.ok, message: data.message });
    setTesting(false);
  }

  if (loading) {
    return <div className="p-4 sm:p-8 text-gray-400 text-sm">Loading settings…</div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure SMTP email delivery and newsletter limits.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Provider toggle ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Email Provider</h2>
          <p className="text-xs text-gray-400 mb-4">Choose which service sends your newsletters. Configure credentials in the matching section below.</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "resend", label: "Resend", badge: "Recommended", color: "indigo" },
              { value: "unosend", label: "Unosend", badge: null, color: "green" },
              { value: "smtp", label: "SMTP", badge: "Fallback", color: "gray" },
            ] as const).map(({ value, label, badge, color }) => {
              const active = settings.email_provider === value;
              const colors: Record<string, string> = {
                indigo: "border-indigo-500 bg-indigo-50 text-indigo-700",
                green: "border-green-500 bg-green-50 text-green-700",
                gray: "border-gray-400 bg-gray-50 text-gray-700",
              };
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, email_provider: value }))}
                  className={`relative flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                    active ? colors[color] : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {label}
                  {badge && (
                    <span className={`text-xs font-normal ${active ? "opacity-80" : "text-gray-400"}`}>{badge}</span>
                  )}
                  {active && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Resend ───────────────────────────────────────────────────── */}
        <div className={`bg-white rounded-xl border p-6 transition-all ${settings.email_provider === "resend" ? "border-indigo-300 ring-1 ring-indigo-100" : "border-gray-200 opacity-60"}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">Resend</h2>
                {settings.email_provider === "resend" && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
              </div>
              <p className="text-xs text-gray-400">Best deliverability · true batch API · free up to 3k emails/month</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
              <input
                type="password"
                value={settings.resend_api_key}
                onChange={(e) => setSettings((s) => ({ ...s, resend_api_key: e.target.value }))}
                placeholder="re_xxxxxxxxxxxxxxxx"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Email</label>
                <input
                  type="email"
                  value={settings.resend_from_email}
                  onChange={(e) => setSettings((s) => ({ ...s, resend_from_email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Name</label>
                <input
                  type="text"
                  value={settings.resend_from_name}
                  onChange={(e) => setSettings((s) => ({ ...s, resend_from_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Unosend ──────────────────────────────────────────────────── */}
        <div className={`bg-white rounded-xl border p-6 transition-all ${settings.email_provider === "unosend" ? "border-green-300 ring-1 ring-green-100" : "border-gray-200 opacity-60"}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">Unosend</h2>
                {settings.email_provider === "unosend" && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
              </div>
              <p className="text-xs text-gray-400">API-based sending</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
              <input
                type="password"
                value={settings.unosend_api_key}
                onChange={(e) => setSettings((s) => ({ ...s, unosend_api_key: e.target.value }))}
                placeholder="un_your_api_key"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Email</label>
                <input
                  type="email"
                  value={settings.unosend_from_email}
                  onChange={(e) => setSettings((s) => ({ ...s, unosend_from_email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Name</label>
                <input
                  type="text"
                  value={settings.unosend_from_name}
                  onChange={(e) => setSettings((s) => ({ ...s, unosend_from_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SMTP Email */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">SMTP Email</h2>
              <p className="text-xs text-gray-400">Works with Brevo (free), AWS SES, Gmail, or any SMTP provider</p>
            </div>
          </div>

          {/* Provider presets */}
          <div className="mb-5">
            <p className="text-xs font-medium text-gray-500 mb-2">Quick setup</p>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    settings.smtp_host === p.host
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p.label}
                  <span className="ml-1.5 text-gray-400 font-normal">{p.description}</span>
                </button>
              ))}
            </div>

            {/* Brevo credentials hint */}
            {settings.smtp_host === "smtp-relay.brevo.com" && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 space-y-2">
                <p className="font-semibold">Brevo setup — follow these steps exactly:</p>
                <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                  <li>In Brevo, go to <strong>SMTP &amp; API</strong> in the left sidebar</li>
                  <li>Click the <strong>SMTP</strong> tab (not the API Keys tab)</li>
                  <li>If you see a &quot;Request access&quot; button, click it — free accounts need SMTP activated separately</li>
                  <li>Once activated, click <strong>Generate a new SMTP key</strong> and copy the key shown (it starts with <code className="bg-blue-100 px-0.5 rounded">xkeysib-</code>)</li>
                  <li><strong>Username</strong> = your Brevo login email address</li>
                  <li><strong>Password</strong> = that SMTP key (not your Brevo account password)</li>
                </ol>
                <p className="text-blue-600">If you still get &quot;Authentication failed&quot; after these steps, check that your Brevo account has a verified sender email address under <strong>Senders &amp; Domains</strong>.</p>
              </div>
            )}

            {/* AWS SES credentials hint */}
            {settings.smtp_host === "email-smtp.us-east-1.amazonaws.com" && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-700 leading-relaxed">
                <strong>AWS SES credentials:</strong> Use SMTP credentials created under{" "}
                <strong>SES → SMTP Settings → Create SMTP credentials</strong> — these are separate from
                your IAM access keys. Make sure your sending identity is verified in SES first.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_100px] gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtp_host}
                  onChange={(e) => setSettings((s) => ({ ...s, smtp_host: e.target.value }))}
                  placeholder="smtp-relay.brevo.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Port</label>
                <input
                  type="number"
                  value={settings.smtp_port}
                  onChange={(e) => setSettings((s) => ({ ...s, smtp_port: e.target.value }))}
                  placeholder="587"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Username / Login</label>
                <input
                  type="text"
                  value={settings.smtp_user}
                  onChange={(e) => setSettings((s) => ({ ...s, smtp_user: e.target.value }))}
                  placeholder="your@email.com"
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password / API Key</label>
                <input
                  type="password"
                  value={settings.smtp_pass}
                  onChange={(e) => setSettings((s) => ({ ...s, smtp_pass: e.target.value }))}
                  placeholder={hasSmtp ? "••••••••" : "SMTP password or API key"}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Email</label>
                <input
                  type="email"
                  value={settings.smtp_from}
                  onChange={(e) => setSettings((s) => ({ ...s, smtp_from: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Name</label>
                <input
                  type="text"
                  value={settings.smtp_from_name}
                  onChange={(e) => setSettings((s) => ({ ...s, smtp_from_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Test connection */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test Connection"}
              </button>
              {testResult && (
                <span className={`text-sm font-medium ${testResult.ok ? "text-green-600" : "text-red-500"}`}>
                  {testResult.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Vercel env vars */}
        <details className="bg-white rounded-xl border border-gray-200 p-5 group">
          <summary className="cursor-pointer text-sm font-semibold text-gray-800 flex items-center justify-between list-none">
            <span>Configure via Vercel environment variables</span>
            <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <p className="mt-3 text-xs text-gray-500 leading-relaxed">
            Set these in your Vercel project under <strong>Settings → Environment Variables</strong>.
            Env vars take effect on next deployment. Database settings (above) override env vars when both are set.
          </p>
          <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Variable</th>
                  <th className="text-left px-3 py-2 font-medium">Brevo example</th>
                  <th className="text-left px-3 py-2 font-medium">AWS SES example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {[
                  ["SMTP_HOST", "smtp-relay.brevo.com", "email-smtp.us-east-1.amazonaws.com"],
                  ["SMTP_PORT", "587", "587"],
                  ["SMTP_USER", "you@youremail.com", "AKIA…(SES SMTP user)"],
                  ["SMTP_PASS", "xsmtp-key-from-brevo", "SMTP secret key from SES"],
                  ["SMTP_FROM", "newsletter@yourdomain.com", "newsletter@yourdomain.com"],
                  ["SMTP_FROM_NAME", "The Gist Decatur", "The Gist Decatur"],
                ].map(([key, brevo, ses]) => (
                  <tr key={key} className="text-gray-600">
                    <td className="px-3 py-2 font-semibold text-gray-800">{key}</td>
                    <td className="px-3 py-2 text-gray-500">{brevo}</td>
                    <td className="px-3 py-2 text-gray-500">{ses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            After adding env vars in Vercel, redeploy (or trigger a redeploy) for them to take effect. The Test Connection button will use them automatically.
          </p>
        </details>

        {/* SPF / DKIM guidance */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-amber-800 mb-2">Improve deliverability with SPF &amp; DKIM</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Add an SPF record to your DNS so receiving servers know your provider is authorized to send on your behalf.
            Your provider&apos;s dashboard will have the exact record to add — usually a <code className="bg-amber-100 px-1 rounded">TXT</code> record
            on your root domain. Brevo and AWS SES both offer one-click DKIM signing as well.
          </p>
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
                Community Partners per issue
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
                Standard ads per issue
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.in_article_count}
                onChange={(e) => setSettings((s) => ({ ...s, in_article_count: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Max standard ads woven into the newsletter (default: 2)</p>
            </div>
          </div>
        </div>

        {/* Sponsorship Pricing */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Sponsorship Pricing</h2>
              <p className="text-xs text-gray-400">Prices shown on the public /sponsor page</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "sponsorship_price_spotlight" as const, label: "Community Partners" },
              { key: "sponsorship_price_in_article" as const, label: "Standard Sponsorship" },
              { key: "sponsorship_price_presenting" as const, label: "Presenting Sponsor" },
              { key: "sponsorship_price_wordy" as const, label: "Decatur Wordy Sponsor" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <input
                  type="text"
                  value={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                  placeholder="$20/day"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Stripe Checkout Prices */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Stripe Checkout Prices</h2>
              <p className="text-xs text-gray-400">Actual amounts charged at checkout. Requires <code className="bg-gray-100 px-1 rounded">STRIPE_SECRET_KEY</code> and <code className="bg-gray-100 px-1 rounded">STRIPE_WEBHOOK_SECRET</code> env vars.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5">
            {[
              { key: "stripe_price_in_article_cents" as const, label: "Standard Ad" },
              { key: "stripe_price_presenting_cents" as const, label: "Presenting Sponsor" },
              { key: "stripe_price_wordy_cents" as const, label: "Decatur Wordy" },
            ].map(({ key, label }) => {
              const dollars = (parseInt(settings[key] || "0", 10) / 100).toFixed(2);
              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {label} <span className="text-gray-400 font-normal text-xs">(= ${dollars})</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 pointer-events-none">¢</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder="1500"
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Enter cents (e.g. 1500 = $15.00)</p>
                </div>
              );
            })}
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
