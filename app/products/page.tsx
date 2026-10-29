"use client";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";

interface ProductCard {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
  soldOut: boolean;
  remaining: number | null;
}

interface GuideCard {
  id: string;
  title: string;
  question: string;
  slug: string;
  priceCents: number;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function ProductsPage() {
  const { workspace } = useWorkspace();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [guides, setGuides] = useState<GuideCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [guidesLoading, setGuidesLoading] = useState(true);

  useEffect(() => {
    workspaceFetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  // Deals guides are not Product rows and never go through product
  // checkout; each card links to the guide's own buy page, where the
  // Mini checkout flow is the only purchase path.
  useEffect(() => {
    workspaceFetch("/api/minis")
      .then((r) => r.json())
      .then((d) => setGuides(d.minis || []))
      .catch(() => setGuides([]))
      .finally(() => setGuidesLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="flex-1">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-center text-gray-900">The Gist Shop</h1>
        <p className="text-center text-gray-500 mt-2">
          Things we make for {workspace.area} readers. Every purchase supports the newsletter directly.
        </p>

        {loading || guidesLoading ? (
          <p className="text-center text-gray-400 mt-12">Loading...</p>
        ) : products.length === 0 && guides.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">Nothing here yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {products.map((p) => (
              <Link key={p.id} href={`/products/${p.slug}`} className="border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow block">
                <div className="relative">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className={`w-full h-48 object-cover ${p.soldOut ? "opacity-60 grayscale" : ""}`} />
                  ) : (
                    <div className="w-full h-48 bg-gray-100" />
                  )}
                  {p.soldOut && (
                    <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold tracking-wide px-2.5 py-1 rounded-full">SOLD OUT</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="font-bold text-lg text-gray-900">{p.name}</div>
                  {p.tagline && <div className="text-sm text-gray-500 mt-1">{p.tagline}</div>}
                  <div className="mt-3 font-semibold text-gray-900">
                    {money(p.priceCents)}
                    {p.compareAtCents && p.compareAtCents > p.priceCents && (
                      <span className="ml-2 text-sm text-gray-400 line-through">{money(p.compareAtCents)}</span>
                    )}
                    {!p.soldOut && p.remaining !== null && p.remaining <= 5 && (
                      <span className="ml-2 text-sm font-semibold text-red-600">Only {p.remaining} left</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {guides.map((g) => (
              <Link key={g.id} href={`/minis/${g.slug}`} className="border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow block">
                <div className="w-full h-48 bg-green-800 flex flex-col items-center justify-center px-6 text-center">
                  <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-green-200">A Gist Deals Guide</div>
                  <div className="mt-2 text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>{g.title}</div>
                </div>
                <div className="p-4">
                  <div className="font-bold text-lg text-gray-900">{g.title}</div>
                  <div className="text-sm text-gray-500 mt-1">{g.question}</div>
                  <div className="mt-3 font-semibold text-gray-900">{money(g.priceCents)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      </main>
    </div>
  );
}
