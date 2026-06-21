"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Issue {
  id: string;
  subject: string;
  sentAt: string;
}

export default function RecentIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    fetch("/api/issues")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setIssues(data.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (issues.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            From the archive
          </p>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Recent Issues</h2>
        </div>
        <Link
          href="/issues"
          className="text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
        >
          View all →
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {issues.map((issue) => {
          const date = new Date(issue.sentAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "America/Chicago",
          });
          return (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className="group block rounded-2xl border border-gray-100 bg-gray-50 hover:border-green-200 hover:bg-green-50 transition-colors p-6"
            >
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-xs text-gray-400 mb-2">{date}</p>
              <p className="font-semibold text-gray-900 leading-snug group-hover:text-green-800 transition-colors">
                {issue.subject}
              </p>
              <p className="text-sm text-green-700 font-medium mt-3">
                Read issue →
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
