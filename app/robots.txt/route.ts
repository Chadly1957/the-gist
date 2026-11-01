import { getWorkspaceUrl } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Origin robots.txt: allow search crawlers everywhere and point them at
// this host's sitemap. Served per domain, so each city advertises its own
// sitemap. (Cloudflare may prepend its managed content-signal block; the
// Sitemap line below is the part search engines act on.)
export async function GET() {
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${base}/sitemap.xml`, ""].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
