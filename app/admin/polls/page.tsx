"use client";

import { useEffect, useState } from "react";

interface PollOption {
  id: string;
  label: string;
  votes: number;
  pct: number;
}

interface Poll {
  id: string;
  question: string;
  createdAt: string;
  totalVotes: number;
  newsletterSend: { id: string; subject: string; sentAt: string | null } | null;
  options: PollOption[];
}

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/polls")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setPolls(d.polls || []);
      })
      .catch(() => setError("Failed to load polls."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Polls</h1>
        <p className="text-sm text-gray-500 mt-1">Results from newsletter polls. Subscribers vote directly from their email.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {polls.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <svg className="mx-auto w-12 h-12 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="font-medium">No polls yet</p>
          <p className="text-sm mt-1">Add a Poll block to a newsletter and send it to start collecting votes.</p>
        </div>
      )}

      <div className="space-y-6">
        {polls.map((poll) => (
          <div key={poll.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900 text-base leading-snug">{poll.question}</p>
                  {poll.newsletterSend && (
                    <p className="text-xs text-gray-400 mt-1">
                      From: <span className="text-gray-500 font-medium">{poll.newsletterSend.subject}</span>
                      {poll.newsletterSend.sentAt && (
                        <> · {new Date(poll.newsletterSend.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                      )}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-lg font-bold text-gray-900">{poll.totalVotes}</span>
                  <p className="text-xs text-gray-400">{poll.totalVotes === 1 ? "vote" : "votes"}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {poll.options.map((opt) => (
                <div key={opt.id}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                    <span className="text-sm text-gray-500 tabular-nums">{opt.pct}% <span className="text-gray-300">({opt.votes})</span></span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full transition-all duration-500"
                      style={{ width: `${opt.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
