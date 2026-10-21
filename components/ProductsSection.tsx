"use client";

import Link from "@/components/workspace/WorkspaceLink";

export interface ShopProduct {
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

// Homepage shop section. Rendered by the landing page only when the
// workspace has at least one active product, so cities without products
// never show an empty storefront.
export default function ProductsSection({ products, area }: { products: ShopProduct[]; area: string }) {
  if (products.length === 0) return null;
  return (
    <section className="py-14 sm:py-20 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">The Gist Shop</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Things we make for {area} readers. Every purchase supports the newsletter directly.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.slug}`} className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow block bg-white">
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
        <div className="text-center mt-10">
          <Link href="/products" className="inline-block px-6 py-3 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 transition-colors">
            Shop all products
          </Link>
        </div>
      </div>
    </section>
  );
}
