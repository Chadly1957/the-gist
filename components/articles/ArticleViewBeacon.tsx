"use client";

import { useEffect } from "react";
import { workspaceFetch } from "@/lib/workspace-client";

// Counts one article view per reader session. The article page itself is
// server-rendered for crawlers; this beacon is what turns a real browser
// visit into a Story.viewCount increment (refreshes within a session and
// non-JS crawlers do not inflate the number).
export default function ArticleViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `gist-article-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable (private mode): still count this mount once.
    }
    workspaceFetch(`/api/articles/${slug}/view`, { method: "POST" }).catch(() => null);
  }, [slug]);

  return null;
}
