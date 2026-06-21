"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function IssuePage() {
  const { id } = useParams<{ id: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [subject, setSubject] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [notFound, setNotFound] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(2400);

  useEffect(() => {
    fetch(`/api/issues?`)
      .then((r) => r.json())
      .then((issues: { id: string; subject: string; sentAt: string }[]) => {
        const match = issues.find((i) => i.id === id);
        if (match) {
          setSubject(match.subject);
          setDate(
            new Date(match.sentAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "America/Chicago",
            })
          );
        }
      })
      .catch(() => {});
  }, [id]);

  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) setIframeHeight(doc.body.scrollHeight + 40);
    } catch {
      // cross-origin — won't happen since same origin
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Issue not found.</p>
          <Link href="/issues" className="text-green-700 hover:underline text-sm">← All issues</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="flex items-center">
          <Logo className="h-10 w-auto" />
        </Link>
        <Link
          href="/issues"
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium"
        >
          ← All issues
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {subject && (
          <div className="mb-4">
            <h1 className="text-xl font-bold text-gray-900">{subject}</h1>
            {date && <p className="text-sm text-gray-400 mt-1">{date}</p>}
          </div>
        )}

        <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
          <iframe
            ref={iframeRef}
            src={`/api/issues/${id}`}
            width="100%"
            height={iframeHeight}
            style={{ border: "none", display: "block" }}
            onLoad={handleIframeLoad}
            onError={() => setNotFound(true)}
            title={subject || "Newsletter issue"}
          />
        </div>
      </div>
    </div>
  );
}
