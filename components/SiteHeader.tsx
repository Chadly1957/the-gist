"use client";
import { workspaceFetch } from "@/lib/workspace-client";

import { useState, useEffect } from "react";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";

// The site's regular sticky nav (logo, Games, Shop, Advertise, Sponsor
// Login, Admin) plus the sponsor-login modal it opens. Shared by the
// homepage and the product pages so a visitor landing anywhere gets the
// same way around the site. Branding and links are workspace-aware via
// Logo and WorkspaceLink; the Shop link renders only when this workspace
// has at least one active product.
export default function SiteHeader() {
  const [products, setProducts] = useState<{ id: string }[]>([]);
  const [showSponsorLogin, setShowSponsorLogin] = useState(false);
  const [sponsorLoginEmail, setSponsorLoginEmail] = useState("");
  const [sponsorLoginStatus, setSponsorLoginStatus] = useState<"idle" | "loading" | "sent">("idle");

  useEffect(() => {
    workspaceFetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d.products) ? d.products : []))
      .catch(() => setProducts([]));
  }, []);

  async function handleSponsorLogin(e: React.FormEvent) {
    e.preventDefault();
    setSponsorLoginStatus("loading");
    await workspaceFetch("/api/sponsor/resend-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: sponsorLoginEmail }),
    });
    setSponsorLoginStatus("sent");
  }

  return (
    <>
      {/* Sponsor Login Modal */}
      {showSponsorLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowSponsorLogin(false); setSponsorLoginStatus("idle"); setSponsorLoginEmail(""); } }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Sponsor Portal Access</h2>
              <button onClick={() => { setShowSponsorLogin(false); setSponsorLoginStatus("idle"); setSponsorLoginEmail(""); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {sponsorLoginStatus === "sent" ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Check your inbox</p>
                <p className="text-xs text-gray-500">If that email is on file, we&apos;ve sent your portal link.</p>
              </div>
            ) : (
              <form onSubmit={handleSponsorLogin}>
                <p className="text-sm text-gray-500 mb-4">Enter your email and we&apos;ll send your portal link right away.</p>
                <input
                  type="email"
                  required
                  autoFocus
                  value={sponsorLoginEmail}
                  onChange={(e) => setSponsorLoginEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="submit"
                  disabled={sponsorLoginStatus === "loading"}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {sponsorLoginStatus === "loading" ? "Sending…" : "Send My Portal Link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="h-10 sm:h-14 w-auto" />
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/games" className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
              Games
            </Link>
            {products.length > 0 && (
              <Link href="/products" className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
                Shop
              </Link>
            )}
            <Link href="/sponsor" className="text-sm font-semibold text-green-700 hover:text-green-800 transition-colors">
              Advertise
            </Link>
            <button
              onClick={() => { setShowSponsorLogin(true); setSponsorLoginStatus("idle"); setSponsorLoginEmail(""); }}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sponsor Login
            </button>
            <Link href="/admin/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Admin
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
