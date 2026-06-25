"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";

function ProfileForm() {
  const searchParams = useSearchParams();
  const recipientId = searchParams.get("r");

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "notfound">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!recipientId) { setStatus("notfound"); setLoading(false); return; }
    fetch(`/api/profile?r=${encodeURIComponent(recipientId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus("notfound"); }
        else { setFirstName(data.firstName || ""); setMaskedEmail(data.email || ""); }
      })
      .catch(() => setStatus("notfound"))
      .finally(() => setLoading(false));
  }, [recipientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/profile?r=${encodeURIComponent(recipientId || "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Something went wrong."); setStatus("error"); return; }
      setStatus("saved");
    } catch {
      setErrorMsg("Connection error. Please try again.");
      setStatus("error");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Link not found</h2>
        <p className="text-sm text-gray-500">
          This link may have expired. Use the link from your most recent newsletter email.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <Logo className="h-12 w-auto mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-1">Update Your Name</h1>
        {maskedEmail && (
          <p className="text-sm text-gray-500">Subscribed as {maskedEmail}</p>
        )}
      </div>

      {status === "saved" ? (
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">
            {firstName.trim() ? `Name updated to "${firstName.trim()}"` : "Name cleared"}
          </p>
          <p className="text-xs text-gray-500">Your referral link will now show your name.</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 text-xs text-green-700 underline"
          >
            Make another change
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-xs font-semibold text-gray-600 mb-1">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your first name"
              maxLength={100}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave blank to remove your name. This is shown when you share your referral link.
            </p>
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === "saving"}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {status === "saving" ? "Saving…" : "Save name"}
          </button>
        </form>
      )}
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <Suspense>
          <ProfileForm />
        </Suspense>
      </div>
    </div>
  );
}
