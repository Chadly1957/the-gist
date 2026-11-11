"use client";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { boardCategoryLabel, boardIntentLabel, boardRunWeeksLabel } from "@/lib/board-constants";

interface BoardPostRow {
  id: string;
  title: string;
  description: string;
  category: string;
  intent: string | null;
  linkUrl: string | null;
  contactInfo: string | null;
  displayName: string | null;
  email: string;
  status: string;
  amountCents: number;
  runWeeks: number;
  paidAt: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  pending_approval: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BoardAdminPage() {
  const [posts, setPosts] = useState<BoardPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function load() {
    const res = await workspaceFetch("/api/admin/board");
    const data = await res.json().catch(() => ({}));
    setPosts(Array.isArray(data.posts) ? data.posts : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setNotice("");
    const target = posts.find((p) => p.id === id);
    const paidLabel = target ? `$${(target.amountCents / 100).toFixed(0)}` : "the payment";
    const res = await workspaceFetch("/api/admin/board", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || "Something went wrong.");
      return;
    }
    if (action === "reject" && data.refunded === false) {
      setNotice(
        data.refundError
          ? `Post rejected, but the refund failed (${data.refundError}). Refund it manually in Stripe.`
          : "Post rejected. No payment intent was on file, so no automatic refund went out."
      );
    } else if (action === "reject") {
      setNotice(`Post rejected and ${paidLabel} was refunded.`);
    } else {
      setNotice(
        `Post approved: it runs for ${target ? boardRunWeeksLabel(target.runWeeks || 1) : "1 week"} in the newsletter and on the Board page.`
      );
    }
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Gist Board</h1>
      <p className="text-sm text-gray-500 mb-6">
        Community classifieds: $5 per week, for 1 to 4 weeks. Posts go live automatically as
        soon as payment clears, and appear in every issue until they expire, plus the public
        Board page. Rejecting a post removes it and refunds what the buyer paid.
      </p>

      {notice && (
        <p className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 mb-6">{notice}</p>
      )}

      {posts.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No board posts yet.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-bold text-gray-900">{p.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {boardCategoryLabel(p.category)}
                {boardIntentLabel(p.intent) ? ` · ${boardIntentLabel(p.intent)}` : ""}
                {p.displayName ? ` · Posted by ${p.displayName}` : ""}
                {` · ${p.email}`}
                {` · Paid $${(p.amountCents / 100).toFixed(0)} · ${boardRunWeeksLabel(p.runWeeks || 1)} run`}
                {p.linkUrl ? ` · ${p.linkUrl}` : ""}
                {p.contactInfo ? ` · Contact: ${p.contactInfo}` : ""}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Submitted {fmt(p.createdAt)}
                {p.approvedAt ? ` · Approved ${fmt(p.approvedAt)}` : ""}
                {p.expiresAt ? ` · Runs until ${fmt(p.expiresAt)}` : ""}
              </p>
              {(p.status === "pending_approval" || p.status === "active") && (
                <div className="flex gap-2 mt-4">
                  {p.status === "pending_approval" && (
                    <button
                      onClick={() => act(p.id, "approve")}
                      className="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      Approve (start {boardRunWeeksLabel(p.runWeeks || 1)} run)
                    </button>
                  )}
                  <button
                    onClick={() => act(p.id, "reject")}
                    className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg"
                  >
                    Reject{ p.status === "pending_approval" ? ` + refund $${(p.amountCents / 100).toFixed(0)}` : ""}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
