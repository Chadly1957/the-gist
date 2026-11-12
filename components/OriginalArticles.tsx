"use client";
import { workspaceFetch } from "@/lib/workspace-client";

import { useEffect, useState } from "react";
import Link from "@/components/workspace/WorkspaceLink";

interface OriginalArticle {
  id: string;
  headline: string;
  slug: string;
  author: string;
  headerImageUrl: string | null;
  excerpt: string | null;
  publishedAt: string | null;
}

// Homepage originals: the 3 latest published first-party articles for this
// workspace, in 3 photo/date/author cards. Renders nothing when the
// workspace has no published originals yet.
export default function OriginalArticles() {
  const [articles, setArticles] = useState<OriginalArticle[]>([]);

  useEffect(() => {
    workspaceFetch("/api/articles?limit=3")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setArticles(data.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (articles.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            From The Gist
          </p>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Original stories from The Gist</h2>
        </div>
        <Link
          href="/articles"
          className="text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
        >
          Read more news →
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        {articles.map((a) => {
          const date = a.publishedAt
            ? new Date(a.publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "America/Chicago",
              })
            : null;
          return (
            <Link
              key={a.id}
              href={`/articles/${a.slug}`}
              className="group block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-green-200 transition-colors"
            >
              {a.headerImageUrl && (
                <img src={a.headerImageUrl} alt={a.headline} className="w-full h-44 object-cover" />
              )}
              <div className="p-6">
                {date && <p className="text-xs text-gray-400 mb-2">{date}</p>}
                <p className="font-bold text-gray-900 leading-snug group-hover:text-green-800 transition-colors">
                  {a.headline}
                </p>
                {a.excerpt && (
                  <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-3">{a.excerpt}</p>
                )}
                <p className="text-xs text-gray-400 mt-4">by {a.author}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
