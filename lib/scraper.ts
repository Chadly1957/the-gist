import axios from "axios";
import * as cheerio from "cheerio";
import RSSParser from "rss-parser";
import { detectLocationTags, isFluffArticle, passesSourceFilter } from "@/lib/article-filter";

const rssParser = new RSSParser({
  customFields: {
    item: ["media:content", "media:thumbnail", "enclosure"],
  },
});

export interface ScrapedArticle {
  title: string;
  description: string;
  imageUrl: string | null;
  articleUrl: string;
  sourceName: string;
  publishedAt: Date;
  tags: string[];
}

// Paths that are almost never real articles (nav, auth, utility pages)
const SKIP_PATH_RE =
  /\/(sign-?up|log-?in|log-?out|register|account|profile|unsubscribe|privacy|terms|faq|help|search|tags?|categor|authors?|page\/\d|feed|cart|checkout|cookie|advertis|home|index|about|contact|newsletter)\/?$/i;

// RSS feed paths to try when auto-detecting
const RSS_PATHS = [
  "/feed",
  "/feed.xml",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/feed/rss",
  "/blog/feed",
  "/news/feed",
  "/?feed=rss2",
];

const HOURS_LOOKBACK = 48;

function isRecent(date: Date): boolean {
  const cutoff = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000);
  return date > cutoff;
}

function truncate(text: string, maxLength = 150): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

function resolveUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 10000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await axios.get(url, {
      signal: controller.signal as AbortSignal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TheGistBot/1.0; newsletter aggregator)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*",
      },
      timeout: timeoutMs,
      maxRedirects: 5,
    });
    return res.data as string;
  } finally {
    clearTimeout(timer);
  }
}

// Extract Open Graph / meta data from an article URL
async function scrapeArticleMeta(
  url: string,
  sourceName: string,
  fallbackDate?: Date
): Promise<ScrapedArticle | null> {
  try {
    const html = await fetchWithTimeout(url);
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").text();

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $("article p").first().text();

    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      null;

    // Try to find published date; reject pages with no real date
    const dateStr =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $("time[datetime]").first().attr("datetime") ||
      "";
    const publishedAt = dateStr ? new Date(dateStr) : fallbackDate;
    if (!publishedAt || isNaN(publishedAt.getTime())) return null;

    if (!title || !description) return null;

    return {
      title: title.trim(),
      description: truncate(description),
      imageUrl: imageUrl ? resolveUrl(imageUrl, url) : null,
      articleUrl: url,
      sourceName,
      publishedAt,
      tags: [],
    };
  } catch {
    return null;
  }
}

// Check if a source URL is a Google News search feed
function isGoogleNewsFeed(url: string): boolean {
  try {
    return new URL(url).hostname === "news.google.com";
  } catch {
    return false;
  }
}

// Follow all redirects and return the final landing URL + page HTML.
// Uses native fetch (not axios) because fetch.Response.url is the final URL
// after all redirects — axios has no equivalent in Node.js.
async function fetchFollowingRedirects(
  url: string,
  timeoutMs = 10000
): Promise<{ finalUrl: string; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TheGistBot/1.0; newsletter aggregator)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*",
      },
      redirect: "follow",
      // Bypass Next.js fetch caching — we always want fresh data
      cache: "no-store",
    });
    const html = await res.text();
    return { finalUrl: res.url, html };
  } finally {
    clearTimeout(timer);
  }
}

// Enrich a Google News RSS item by following its redirect URL to the real
// article page, then scraping OG metadata for image, description, and title.
// Google News titles end with " - Publisher Name"; that suffix is stripped to
// produce a clean headline. sourceName is the user-assigned name from Sources.
async function enrichGoogleNewsItem(
  googleUrl: string,
  rawTitle: string,
  pubDate: Date,
  sourceName: string
): Promise<ScrapedArticle | null> {
  try {
    const { finalUrl, html } = await fetchFollowingRedirects(googleUrl);

    // If the redirect didn't escape Google, skip
    if (new URL(finalUrl).hostname.includes("google.com")) return null;

    const $ = cheerio.load(html);

    // Strip " - Publisher Name" suffix from Google News titles
    const lastDash = rawTitle.lastIndexOf(" - ");
    const cleanRawTitle = lastDash > 0 ? rawTitle.slice(0, lastDash).trim() : rawTitle;

    const title = stripHtml(
      $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("h1").first().text() ||
        cleanRawTitle
    );

    const description = truncate(
      $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        $('meta[name="twitter:description"]').attr("content") ||
        $("article p").first().text() ||
        ""
    );

    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      null;

    if (!title || !description) return null;
    if (isFluffArticle(title, description)) return null;

    return {
      title,
      description,
      imageUrl: imageUrl ? resolveUrl(imageUrl, finalUrl) : null,
      articleUrl: finalUrl,
      sourceName,
      publishedAt: pubDate,
      tags: [],
    };
  } catch {
    return null;
  }
}

// Try to find and parse an RSS feed for a given source URL
async function scrapeViaRSS(
  sourceUrl: string,
  sourceName: string
): Promise<ScrapedArticle[]> {
  const isGoogleNews = isGoogleNewsFeed(sourceUrl);
  const parsed = new URL(sourceUrl);
  const base = parsed.origin;
  // Strip trailing slash from the section path (e.g. "/news/illinois")
  const sectionPath = parsed.pathname.replace(/\/+$/, "");

  // Try section-specific feeds before root-level ones so that a source URL
  // like /news/illinois/ gets its own feed rather than the site-wide feed.
  const sectionCandidates = sectionPath
    ? RSS_PATHS.map((p) => `${base}${sectionPath}${p}`)
    : [];

  const candidates = [
    sourceUrl,             // maybe it IS a feed
    ...sectionCandidates,  // e.g. /news/illinois/feed
    ...RSS_PATHS.map((p) => base + p), // root-level fallback
  ];

  for (const candidate of candidates) {
    try {
      const feed = await rssParser.parseURL(candidate);

      // --- Google News path: follow each redirect to get real article data ---
      if (isGoogleNews) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recentItems = (feed.items ?? []).filter((item: any) => {
          if (!item.pubDate && !item.isoDate) return false;
          const d = new Date(item.isoDate ?? item.pubDate ?? "");
          return !isNaN(d.getTime()) && isRecent(d);
        });

        if (recentItems.length === 0) continue;

        const articles: ScrapedArticle[] = [];

        await Promise.allSettled(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recentItems.map(async (item: any) => {
            const pubDate = new Date(item.isoDate ?? item.pubDate ?? "");
            const itemUrl = item.link ?? item.guid ?? "";
            if (!itemUrl) return;

            const rawTitle: string = item.title ?? "";
            // Google News titles end with " - Publisher Name" — strip that
            const lastDash = rawTitle.lastIndexOf(" - ");
            const cleanTitle = stripHtml(
              lastDash > 0 ? rawTitle.slice(0, lastDash).trim() : rawTitle
            );
            if (!cleanTitle) return;

            // Attempt to follow the redirect and scrape real OG metadata
            const enriched = await enrichGoogleNewsItem(
              itemUrl,
              rawTitle,
              pubDate,
              sourceName
            );
            if (enriched) {
              articles.push(enriched);
              return;
            }

            // Fallback: use RSS data with cleaned title + user-assigned source name.
            // The image will be absent but the article is not silently dropped.
            const description = truncate(
              item.contentSnippet ||
                stripHtml(item.content ?? item["content:encoded"] ?? "") ||
                item.summary ||
                ""
            );
            if (!description || isFluffArticle(cleanTitle, description)) return;

            articles.push({
              title: cleanTitle,
              description,
              imageUrl: null,
              articleUrl: itemUrl,
              sourceName,
              publishedAt: pubDate,
              tags: [],
            });
          })
        );

        if (articles.length > 0) return articles;
        continue;
      }

      // --- Standard RSS path ---
      const articles: ScrapedArticle[] = [];

      for (const item of feed.items ?? []) {
        if (!item.pubDate && !item.isoDate) continue; // skip dateless items
        const pubDate = new Date(item.isoDate ?? item.pubDate ?? "");
        if (isNaN(pubDate.getTime()) || !isRecent(pubDate)) continue;

        const itemUrl = item.link ?? item.guid ?? "";
        if (!itemUrl) continue;

        // Try to get image from RSS item fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemAny = item as any;
        const imageUrl =
          itemAny["media:content"]?.["$"]?.url ||
          itemAny["media:thumbnail"]?.["$"]?.url ||
          itemAny["enclosure"]?.url ||
          extractFirstImage(item.content ?? itemAny["content:encoded"] ?? "") ||
          null;

        const title = stripHtml(item.title ?? "");

        const description = truncate(
          item.contentSnippet ||
            stripHtml(item.content ?? itemAny["content:encoded"] ?? "") ||
            item.summary ||
            ""
        );

        if (!title || !description) continue;
        if (isFluffArticle(title, description)) continue;

        articles.push({
          title,
          description,
          imageUrl,
          articleUrl: itemUrl,
          sourceName: feed.title || sourceName,
          publishedAt: pubDate,
          tags: [],
        });
      }

      if (articles.length > 0) {
        // Many feeds omit image data; fall back to scraping each
        // image-less article's own page for an og:image.
        const missingImage = articles.filter((a) => !a.imageUrl);
        if (missingImage.length > 0) {
          const imageResults = await Promise.allSettled(
            missingImage.map((a) => scrapeOgImage(a.articleUrl))
          );
          missingImage.forEach((article, i) => {
            const result = imageResults[i];
            if (result.status === "fulfilled" && result.value) {
              article.imageUrl = result.value;
            }
          });
        }
        return articles;
      }
    } catch {
      // Try next candidate
    }
  }

  return [];
}

// Lightweight fetch of just the og:image for a single article page
async function scrapeOgImage(url: string): Promise<string | null> {
  try {
    const html = await fetchWithTimeout(url, 7000);
    const $ = cheerio.load(html);
    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      null;
    return image ? resolveUrl(image, url) : null;
  } catch {
    return null;
  }
}

// Fall back to scraping the source homepage for article links, then meta-scrape each
async function scrapeViaHTML(
  sourceUrl: string,
  sourceName: string
): Promise<ScrapedArticle[]> {
  try {
    const html = await fetchWithTimeout(sourceUrl);
    const $ = cheerio.load(html);
    const base = new URL(sourceUrl).href;
    const sourceOrigin = new URL(sourceUrl).origin;

    const links = new Set<string>();

    // Find article-like links — look inside content containers, not nav/header/footer
    $(
      'a[href*="/article"], a[href*="/news"], a[href*="/story"], a[href*="/post"], article a, h2 a, h3 a, .post-title a, main a'
    )
      .not("nav a, header a, footer a, [role='navigation'] a, [role='banner'] a, [role='contentinfo'] a")
      .each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const resolved = resolveUrl(href, base);
        try {
          const parsed = new URL(resolved);
          // Same domain only
          if (parsed.origin !== sourceOrigin) return;
          // Skip obvious non-article paths
          if (SKIP_PATH_RE.test(parsed.pathname)) return;
          // Must have at least one real path segment (not just the root)
          if (parsed.pathname.split("/").filter(Boolean).length < 1) return;
          links.add(resolved);
        } catch {
          // ignore unparseable URLs
        }
      });

    const articles: ScrapedArticle[] = [];
    const toFetch = Array.from(links).slice(0, 15); // limit to 15 per source

    const results = await Promise.allSettled(
      toFetch.map((url) => scrapeArticleMeta(url, sourceName))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const article = result.value;
        if (isRecent(article.publishedAt) && !isFluffArticle(article.title, article.description)) {
          articles.push({ ...article, tags: [] });
        }
      }
    }

    return articles;
  } catch {
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractFirstImage(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

// Main export: scrape a single source URL.
// Runs RSS and HTML scraping in parallel so section-page articles are never
// missed when a root-level RSS feed succeeds but doesn't include section content.
// RSS takes precedence for any URL that appears in both (better pub dates).
export async function scrapeSource(
  sourceUrl: string,
  sourceName: string,
  keywords = ""
): Promise<ScrapedArticle[]> {
  const [rssResult, htmlResult] = await Promise.allSettled([
    scrapeViaRSS(sourceUrl, sourceName),
    scrapeViaHTML(sourceUrl, sourceName),
  ]);

  const rssArticles = rssResult.status === "fulfilled" ? rssResult.value : [];
  const htmlArticles = htmlResult.status === "fulfilled" ? htmlResult.value : [];

  // Merge: RSS takes precedence (reliable dates); HTML fills in anything missing
  const rssUrls = new Set(rssArticles.map((a) => a.articleUrl));
  const combined = [
    ...rssArticles,
    ...htmlArticles.filter((a) => !rssUrls.has(a.articleUrl)),
  ];

  return combined.filter((a) => passesSourceFilter(a.title, a.description, keywords));
}

const SOURCE_TIMEOUT_MS = 30_000;

export interface SourceResult {
  name: string;
  count: number;
  error?: string;
}

// Scrape all active sources, then tag each article with location keywords.
// onSourceDone is called as each source finishes (or times out) so callers
// can stream real-time progress to the client.
export async function scrapeAllSources(
  sources: { url: string; name: string; keywords?: string }[],
  onSourceDone?: (result: SourceResult) => void
): Promise<ScrapedArticle[]> {
  const all: ScrapedArticle[] = [];

  await Promise.allSettled(
    sources.map(async (s) => {
      try {
        const articles = await Promise.race([
          scrapeSource(s.url, s.name, s.keywords ?? ""),
          new Promise<ScrapedArticle[]>((_, reject) =>
            setTimeout(() => reject(new Error("Timed out")), SOURCE_TIMEOUT_MS)
          ),
        ]);
        all.push(...articles);
        onSourceDone?.({ name: s.name, count: articles.length });
      } catch (err) {
        onSourceDone?.({
          name: s.name,
          count: 0,
          error: String(err).replace(/^Error:\s*/, ""),
        });
      }
    })
  );

  // Deduplicate by URL, sort newest first, then apply location tags
  const seen = new Set<string>();
  return all
    .filter((a) => {
      if (seen.has(a.articleUrl)) return false;
      seen.add(a.articleUrl);
      return true;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .map((a) => ({ ...a, tags: detectLocationTags(a.title, a.description) }));
}
