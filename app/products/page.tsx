"use client";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";

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

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function ProductsPage() {
  const { workspace } = useWorkspace();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workspaceFetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-900">The Gist Shop</h1>
        <p className="text-center text-gray-500 mt-2">
          Things we make for {workspace.area} readers. Every purchase supports the newsletter directly.
        </p>

        {loading ? (
          <p className="text-center text-gray-400 mt-12">Loading...</p>
        ) : products.length === 0 ? (
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
          </div>
        )}
      </div>
    </main>
  );
}
