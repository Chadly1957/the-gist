"use client";
import { workspaceFetch } from "@/lib/workspace-client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "@/components/workspace/WorkspaceLink";

// Closing "what is this site" section for pages a first-time visitor may
// land on (product pages). Copy is driven entirely by the current
// workspace (name + area) so it renders correctly for every city, and the
// subscriber count comes from the same /api/subscriber-count endpoint the
// homepage hero uses (rounded down; omitted when too small to mention).
export default function AboutGist() {
  const { workspace } = useWorkspace();
  const [subCount, setSubCount] = useState<number | null>(null);

  useEffect(() => {
    workspaceFetch("/api/subscriber-count")
      .then((r) => r.json())
      .then((d) => setSubCount(d.rounded ?? null))
      .catch(() => null);
  }, []);

  return (
    <section className="border-t border-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-3">
          What is {workspace.name}?
        </h2>
        <p className="text-gray-500 leading-relaxed mb-8">
          {workspace.name} is a free daily email with the local news, events, and deals
          that matter in {workspace.area}, in one quick read every morning.
          {subCount !== null && subCount >= 10 && (
            <> Join {subCount.toLocaleString()}+ {workspace.area} neighbors who already start their day with it.</>
          )}
        </p>
        <Link
          href="/join"
          className="inline-block bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors"
        >
          Subscribe free
        </Link>
        <p className="text-xs text-gray-400 mt-4">Free forever. One email a day. No fluff.</p>
      </div>
    </section>
  );
}
