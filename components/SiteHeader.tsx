"use client";
import { workspaceFetch } from "@/lib/workspace-client";

import { useState, useEffect, useRef } from "react";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";

// The site's regular sticky nav plus the sponsor-login modal it opens.
// Shared by every public page so a visitor landing anywhere gets the same
// way around the site. Branding and links are workspace-aware via Logo and
// WorkspaceLink; the Shop link renders only when this workspace has at
// least one active product. On desktop the links are grouped into two
// click-to-open dropdowns (Explore, For Businesses) plus Shop and Admin;
// on small screens everything collapses into a flat hamburger menu and
// the logo always links back to the workspace homepage.
export default function SiteHeader() {
  const [products, setProducts] = useState<{ id: string }[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<null | "explore" | "business">(null);
  const desktopNavRef = useRef<HTMLElement>(null);

  // Close an open dropdown on outside click or Escape. A fixed backdrop
  // button does NOT work here: the header's backdrop-blur makes the header
  // the containing block for fixed descendants, so the backdrop would only
  // cover the header bar itself and clicks on the page below would miss it.
  useEffect(() => {
    if (openDropdown === null) return;
    function onMouseDown(e: MouseEvent) {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenDropdown(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openDropdown]);
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/" aria-label="Back to homepage" className="flex items-center">
            <Logo className="h-10 sm:h-14 w-auto" />
          </Link>
          {/* Desktop links: grouped into dropdowns, click to open */}
          <nav ref={desktopNavRef} className="hidden md:flex items-center gap-6">
            <div className="relative">
              <button
                type="button"
                aria-expanded={openDropdown === "explore"}
                onClick={() => setOpenDropdown((v) => (v === "explore" ? null : "explore"))}
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                Explore
                <svg className={`w-3.5 h-3.5 transition-transform ${openDropdown === "explore" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openDropdown === "explore" && (
                  <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2 overflow-hidden">
                    <Link href="/articles" onClick={() => setOpenDropdown(null)} className="block px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      News
                    </Link>
                    <Link href="/board" onClick={() => setOpenDropdown(null)} className="block px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      Board
                    </Link>
                    <Link href="/games" onClick={() => setOpenDropdown(null)} className="block px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      Games
                    </Link>
                  </div>
              )}
            </div>
            {products.length > 0 && (
              <Link href="/products" className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
                Shop
              </Link>
            )}
            <div className="relative">
              <button
                type="button"
                aria-expanded={openDropdown === "business"}
                onClick={() => setOpenDropdown((v) => (v === "business" ? null : "business"))}
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                For Businesses
                <svg className={`w-3.5 h-3.5 transition-transform ${openDropdown === "business" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openDropdown === "business" && (
                  <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2 overflow-hidden">
                    <Link href="/sponsor" onClick={() => setOpenDropdown(null)} className="block px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-gray-50">
                      Advertise
                    </Link>
                    <button
                      onClick={() => { setOpenDropdown(null); setShowSponsorLogin(true); setSponsorLoginStatus("idle"); setSponsorLoginEmail(""); }}
                      className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      Sponsor Login
                    </button>
                  </div>
              )}
            </div>
            <Link href="/admin/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Admin
            </Link>
          </nav>
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={showMenu ? "Close menu" : "Open menu"}
            aria-expanded={showMenu}
            onClick={() => setShowMenu((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {showMenu ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
        {/* Mobile menu panel */}
        {showMenu && (
          <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-2">
            <Link href="/articles" onClick={() => setShowMenu(false)} className="block py-3 text-sm font-semibold text-gray-700 border-b border-gray-50">
              News
            </Link>
            <Link href="/games" onClick={() => setShowMenu(false)} className="block py-3 text-sm font-semibold text-gray-700 border-b border-gray-50">
              Games
            </Link>
            <Link href="/board" onClick={() => setShowMenu(false)} className="block py-3 text-sm font-semibold text-gray-700 border-b border-gray-50">
              Board
            </Link>
            {products.length > 0 && (
              <Link href="/products" onClick={() => setShowMenu(false)} className="block py-3 text-sm font-semibold text-gray-700 border-b border-gray-50">
                Shop
              </Link>
            )}
            <Link href="/sponsor" onClick={() => setShowMenu(false)} className="block py-3 text-sm font-semibold text-green-700 border-b border-gray-50">
              Advertise
            </Link>
            <button
              onClick={() => { setShowMenu(false); setShowSponsorLogin(true); setSponsorLoginStatus("idle"); setSponsorLoginEmail(""); }}
              className="block w-full text-left py-3 text-sm font-semibold text-gray-500 border-b border-gray-50"
            >
              Sponsor Login
            </button>
            <Link href="/admin/login" onClick={() => setShowMenu(false)} className="block py-3 text-sm text-gray-400">
              Admin
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
