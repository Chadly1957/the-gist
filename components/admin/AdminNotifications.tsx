"use client";
import Link from "@/components/workspace/WorkspaceLink";
import { useState } from "react";

export interface AdminNotificationData {
  boardPending: number;
  boardItems: { id: string; title: string; createdAt: string }[];
  sponsorPending: number;
  sponsorItems: { id: string; label: string; createdAt: string }[];
  ordersUnfulfilled: number;
  orderItems: { id: string; label: string; createdAt: string | null }[];
  recentProfiles: { id: string; businessName: string; createdAt: string }[];
  total: number;
}

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AdminNotifications({
  notes,
  onRefresh,
}: {
  notes: AdminNotificationData | null;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const total = notes?.total ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          if (!open) onRefresh();
          setOpen(!open);
        }}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-3 3h-2a3 3 0 01-3-3v-1m6 0H9" />
        </svg>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Notifications</p>
              <button type="button" onClick={onRefresh} className="text-xs text-blue-600 hover:underline">
                Refresh
              </button>
            </div>

            {!notes ? (
              <p className="px-4 py-4 text-sm text-gray-500">Loading…</p>
            ) : total === 0 && notes.recentProfiles.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-500">All caught up. Nothing needs your attention.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {total > 0 && (
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Needs your attention</p>
                  </div>
                )}
                {notes.boardPending > 0 && (
                  <Link href="/admin/board" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-800">
                      📌 {notes.boardPending} board post{notes.boardPending !== 1 ? "s" : ""} awaiting approval
                    </p>
                    {notes.boardItems.slice(0, 3).map((b) => (
                      <p key={b.id} className="text-xs text-gray-500 truncate">
                        {b.title} · {fmt(b.createdAt)}
                      </p>
                    ))}
                  </Link>
                )}
                {notes.sponsorPending > 0 && (
                  <Link href="/admin/sponsors" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-800">
                      ★ {notes.sponsorPending} sponsor item{notes.sponsorPending !== 1 ? "s" : ""} pending review
                    </p>
                    {notes.sponsorItems.slice(0, 3).map((s) => (
                      <p key={s.id} className="text-xs text-gray-500 truncate">
                        {s.label} · {fmt(s.createdAt)}
                      </p>
                    ))}
                  </Link>
                )}
                {notes.ordersUnfulfilled > 0 && (
                  <Link href="/admin/products" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-800">
                      🛍️ {notes.ordersUnfulfilled} paid order{notes.ordersUnfulfilled !== 1 ? "s" : ""} to fulfill
                    </p>
                    {notes.orderItems.slice(0, 3).map((o) => (
                      <p key={o.id} className="text-xs text-gray-500 truncate">
                        {o.label} · {fmt(o.createdAt)}
                      </p>
                    ))}
                  </Link>
                )}
                {notes.recentProfiles.length > 0 && (
                  <>
                    <div className="px-4 pt-3 pb-1 border-t border-gray-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">New sponsor profiles · past 7 days</p>
                    </div>
                    <Link href="/admin/sponsors" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-gray-50">
                      {notes.recentProfiles.map((p) => (
                        <p key={p.id} className="text-xs text-gray-500 truncate">
                          {p.businessName} · {fmt(p.createdAt)}
                        </p>
                      ))}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
