"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { workspaceFetch } from "@/lib/workspace-client";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";

interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
  galleryUrls: string[];
  fulfillmentNote: string | null;
  soldOut: boolean;
  remaining: number | null;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function ProductPage() {
  const params = useParams();
  const search = useSearchParams();
  const slug = String(params.slug || "");
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    workspaceFetch(`/api/products/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        const d = await r.json();
        setProduct(d.product);
        setSelectedImage(d.product.imageUrl);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  const buy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setBuying(true);
    setError("");
    try {
      const res = await workspaceFetch("/api/products/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBuying(false);
    }
  };

  if (notFound) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">That product is not available.</p>
          <Link href="/products" className="text-green-700 font-semibold hover:underline">See all products</Link>
        </div>
      </main>
    );
  }
  if (!product) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  const images = [product.imageUrl, ...product.galleryUrls].filter(Boolean) as string[];
  const paragraphs = (product.description || "").split(/\n\s*\n/).filter(Boolean);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Logo />
          <Link href="/products" className="text-sm text-gray-500 hover:text-gray-800">← All products</Link>
        </div>

        {search.get("cancelled") && (
          <div className="mb-6 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">Checkout was cancelled. No charge was made.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            {selectedImage && <img src={selectedImage} alt={product.name} className="w-full rounded-2xl border object-cover" />}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {images.map((u, i) => (
                  <button key={i} onClick={() => setSelectedImage(u)} className={`border rounded-lg overflow-hidden ${selectedImage === u ? "ring-2 ring-green-700" : ""}`}>
                    <img src={u} alt="" className="w-16 h-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            {product.tagline && <p className="text-lg text-gray-500 mt-2">{product.tagline}</p>}
            <div className="mt-4 text-2xl font-bold text-gray-900">
              {money(product.priceCents)}
              {product.compareAtCents && product.compareAtCents > product.priceCents && (
                <span className="ml-3 text-lg text-gray-400 line-through">{money(product.compareAtCents)}</span>
              )}
            </div>
            {product.fulfillmentNote && (
              <p className="mt-3 text-sm bg-green-50 text-green-800 border border-green-200 rounded-lg px-3 py-2">{product.fulfillmentNote}</p>
            )}

            {product.soldOut ? (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <div className="text-xl font-bold text-red-700 tracking-wide">SOLD OUT</div>
                <p className="text-sm text-red-600 mt-1">This one is gone. If more get made, newsletter readers hear about it first.</p>
              </div>
            ) : (
              <form onSubmit={buy} className="mt-6 space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Email for your receipt</span>
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2.5" placeholder="you@example.com" />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={buying} className="w-full py-3 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50">
                  {buying ? "Taking you to checkout..." : `Buy now — ${money(product.priceCents)}`}
                </button>
                {product.remaining !== null && product.remaining <= 5 && (
                  <p className="text-sm font-semibold text-red-600 text-center">Only {product.remaining} left</p>
                )}
                <p className="text-xs text-gray-400 text-center">Secure checkout by Stripe. The Gist never sees your card.</p>
              </form>
            )}
          </div>
        </div>

        {paragraphs.length > 0 && (
          <div className="max-w-3xl mx-auto mt-14 space-y-4">
            {paragraphs.map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed">{para}</p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
