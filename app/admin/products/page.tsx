"use client";

import { useEffect, useRef, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";

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
  quantity: number | null;
  requiresShipping: boolean;
  stripePaymentLinkId: string | null;
  status: string;
  paidCount?: number;
  orderCount?: number;
}

const EMPTY_FORM = {
  name: "",
  tagline: "",
  description: "",
  price: "",
  compareAt: "",
  imageUrl: "",
  galleryUrls: [] as string[],
  fulfillmentNote: "",
  quantity: "",
  requiresShipping: true,
  stripePaymentLinkId: "",
  status: "draft",
};

interface ProductOrder {
  id: string;
  email: string;
  amountCents: number;
  paidAt: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

export default function ProductsPage() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [ordersFor, setOrdersFor] = useState<string | null>(null);
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const heroInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await workspaceFetch("/api/admin/products");
      const data = await res.json();
      setList(data.products || []);
    } catch {
      setError("Failed to load products.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await workspaceFetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    return data.url as string;
  };

  const onHeroPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      if (url) setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setUploading(false);
    e.target.value = "";
  };

  const onGalleryPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      if (url) setForm((f) => ({ ...f, galleryUrls: [...f.galleryUrls, url].slice(0, 6) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setUploading(false);
    e.target.value = "";
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      tagline: p.tagline || "",
      description: p.description || "",
      price: (p.priceCents / 100).toFixed(2),
      compareAt: p.compareAtCents ? (p.compareAtCents / 100).toFixed(2) : "",
      imageUrl: p.imageUrl || "",
      galleryUrls: p.galleryUrls || [],
      fulfillmentNote: p.fulfillmentNote || "",
      quantity: p.quantity === null || p.quantity === undefined ? "" : String(p.quantity),
      requiresShipping: p.requiresShipping !== false,
      stripePaymentLinkId: p.stripePaymentLinkId || "",
      status: p.status,
    });
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const payload = {
      name: form.name,
      tagline: form.tagline,
      description: form.description,
      priceCents: Math.round(parseFloat(form.price || "0") * 100),
      compareAtCents: form.compareAt ? Math.round(parseFloat(form.compareAt) * 100) : null,
      imageUrl: form.imageUrl || null,
      galleryUrls: form.galleryUrls,
      fulfillmentNote: form.fulfillmentNote,
      quantity: form.quantity === "" ? null : Math.floor(Number(form.quantity)),
      requiresShipping: form.requiresShipping,
      stripePaymentLinkId: form.stripePaymentLinkId.trim() || null,
      status: form.status,
    };
    try {
      const url = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
      const res = await workspaceFetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSuccess(editingId ? "Product updated." : `Product created. Its page is live at /products/${data.product.slug} once set to Active.`);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
    setSaving(false);
  };

  const syncLinkOrders = async () => {
    if (!editingId) return;
    setSyncing(true);
    setError("");
    setSuccess("");
    try {
      const res = await workspaceFetch(`/api/admin/products/${editingId}/sync-payment-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed.");
      setSuccess(`Payment Link sync done: ${data.imported} new order(s) imported, ${data.paidTotal} paid total on this product.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    }
    setSyncing(false);
  };

  const toggleOrders = async (p: Product) => {
    if (ordersFor === p.id) {
      setOrdersFor(null);
      return;
    }
    setOrdersFor(p.id);
    setOrders([]);
    setOrdersLoading(true);
    try {
      const res = await workspaceFetch(`/api/admin/products/${p.id}/orders`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load orders.");
      setOrders(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    }
    setOrdersLoading(false);
  };

  const setStatus = async (p: Product, status: string) => {
    try {
      const res = await workspaceFetch(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status change failed.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed.");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a product here and it gets a marketing page at /products/&lt;slug&gt; with Stripe checkout built in.
          </p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          + New Product
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={submit} className="mb-8 p-5 border rounded-xl bg-gray-50 space-y-4">
          <h2 className="font-semibold">{editingId ? "Edit product" : "New product"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Decatur-opoly" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Tagline (shown under the name)</span>
              <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="The Decatur board game, made in Decatur" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Price (USD)</span>
              <input required type="number" step="0.01" min="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="99.00" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Compare-at price (optional strikethrough)</span>
              <input type="number" step="0.01" min="0" value={form.compareAt} onChange={(e) => setForm({ ...form, compareAt: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Description (the marketing page body, blank line = new paragraph)</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" rows={6} placeholder="Tell the story of the product..." />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Fulfillment note (shown near the buy button)</span>
              <input value={form.fulfillmentNote} onChange={(e) => setForm({ ...form, fulfillmentNote: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Pre-order: printed once 10 orders land, full refunds if we don't get there" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Quantity available (blank = unlimited)</span>
              <input type="number" step="1" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Unlimited" />
              <span className="text-xs text-gray-400">When paid orders reach this number, the pages show SOLD OUT and checkout closes. Use 0 to force sold out.</span>
            </label>
            <label className="flex items-start gap-2 md:col-span-2">
              <input type="checkbox" checked={form.requiresShipping} onChange={(e) => setForm({ ...form, requiresShipping: e.target.checked })} className="mt-1" />
              <span>
                <span className="text-sm font-medium">Requires a shipping address</span>
                <span className="block text-xs text-gray-400">On for physical products: checkout requires the buyer's shipping name and address, and it is saved on the order for fulfillment. Turn off for digital products.</span>
              </span>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Legacy Stripe Payment Link ID (optional)</span>
              <input value={form.stripePaymentLinkId} onChange={(e) => setForm({ ...form, stripePaymentLinkId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="plink_..." />
              <span className="text-xs text-gray-400">If this product was already selling through a Stripe Payment Link, paste its ID (in the link's Stripe dashboard URL) and every sale from that link files under this product automatically.</span>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Status</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="draft">Draft (hidden)</option>
                <option value="active">Active (live)</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium">Hero image</span>
              <div className="mt-1 flex items-center gap-3">
                {form.imageUrl && <img src={form.imageUrl} alt="" className="w-20 h-20 object-cover rounded-lg border" />}
                <button type="button" onClick={() => heroInput.current?.click()} disabled={uploading} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50">
                  {uploading ? "Uploading..." : form.imageUrl ? "Replace hero image" : "Upload hero image"}
                </button>
                {form.imageUrl && <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="text-sm text-red-600">Remove</button>}
                <input ref={heroInput} type="file" accept="image/*" className="hidden" onChange={onHeroPick} />
              </div>
              <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="mt-2 w-full border rounded-lg px-3 py-2 text-sm" placeholder="...or paste an image URL" />
            </div>
            <div>
              <span className="text-sm font-medium">Gallery images (up to 6)</span>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {form.galleryUrls.map((u, i) => (
                  <span key={i} className="relative inline-block">
                    <img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, galleryUrls: f.galleryUrls.filter((_, j) => j !== i) }))} className="absolute -top-2 -right-2 bg-white border rounded-full w-5 h-5 text-xs leading-none">×</button>
                  </span>
                ))}
                <button type="button" onClick={() => galleryInput.current?.click()} disabled={uploading} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50">
                  {uploading ? "Uploading..." : "Add gallery image"}
                </button>
                <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={onGalleryPick} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Save changes" : "Create product"}
            </button>
            {editingId && form.stripePaymentLinkId.trim() && (
              <button type="button" onClick={syncLinkOrders} disabled={syncing} className="px-4 py-2.5 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                {syncing ? "Syncing..." : "Sync Payment Link orders"}
              </button>
            )}
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : list.length === 0 ? (
        <p className="text-gray-500">No products yet. Decatur-opoly could be the first one in the system.</p>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <div key={p.id} className="border rounded-xl">
            <div className="p-4 flex items-center gap-4">
              {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-14 h-14 object-cover rounded-lg border" /> : <div className="w-14 h-14 rounded-lg border bg-gray-50" />}
              <div className="flex-1">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-500">
                  {money(p.priceCents)} · /products/{p.slug} · {p.paidCount ?? 0} paid orders
                  {p.quantity !== null && p.quantity !== undefined && (
                    <> · {(p.paidCount ?? 0) >= p.quantity ? <span className="text-red-600 font-semibold">SOLD OUT</span> : `${p.quantity - (p.paidCount ?? 0)} left of ${p.quantity}`}</>
                  )}
                </div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>{p.status}</span>
              {p.status !== "active" && <button onClick={() => setStatus(p, "active")} className="text-sm text-green-700 hover:underline">Go live</button>}
              {p.status === "active" && <button onClick={() => setStatus(p, "draft")} className="text-sm text-gray-500 hover:underline">Unpublish</button>}
              <button onClick={() => openEdit(p)} className="text-sm text-blue-600 hover:underline">Edit</button>
              <button onClick={() => toggleOrders(p)} className="text-sm text-blue-600 hover:underline">{ordersFor === p.id ? "Hide orders" : "Orders"}</button>
            </div>
            {ordersFor === p.id && (
              <div className="px-4 pb-4">
                {ordersLoading ? (
                  <p className="text-sm text-gray-500">Loading orders...</p>
                ) : orders.length === 0 ? (
                  <p className="text-sm text-gray-500">No paid orders yet.</p>
                ) : (
                  <div className="border-t pt-3 space-y-3">
                    {orders.map((o) => (
                      <div key={o.id} className="text-sm flex flex-wrap gap-x-8 gap-y-1">
                        <div>
                          <div className="font-medium">{o.email}</div>
                          <div className="text-gray-500">
                            {money(o.amountCents)}
                            {o.paidAt && <> · {new Date(o.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
                          </div>
                        </div>
                        <div className="text-gray-600">
                          {o.shippingLine1 ? (
                            <>
                              <div>{o.shippingName || ""}</div>
                              <div>{o.shippingLine1}</div>
                              {o.shippingLine2 && <div>{o.shippingLine2}</div>}
                              <div>
                                {[o.shippingCity, o.shippingState].filter(Boolean).join(", ")} {o.shippingPostalCode || ""}
                                {o.shippingCountry && o.shippingCountry !== "US" ? ` · ${o.shippingCountry}` : ""}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-400">No shipping address collected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
