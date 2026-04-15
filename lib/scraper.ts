import axios from "axios";
import * as cheerio from "cheerio";
import RSSParser from "rss-parser";

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
}

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

    // Try to find published date
    const dateStr =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $("time[datetime]").first().attr("datetime") ||
      "";
    const publishedAt = dateStr ? new Date(dateStr) : (fallbackDate ?? new Date());

    if (!title || !description) return null;

    return {
      title: title.trim(),
      description: truncate(description),
      imageUrl: imageUrl ? resolveUrl(imageUrl, url) : null,
      articleUrl: url,
      sourceName,
      publishedAt: isNaN(publishedAt.getTime()) ? (fallbackDate ?? new Date()) : publishedAt,
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
  const base = new URL(sourceUrl).origin;

  const candidates = [
    sourceUrl, // maybe it IS a feed
    ...RSS_PATHS.map((p) => base + p),
  ];

  for (const candidate of candidates) {
    try {
      const feed = await rssParser.parseURL(candidate);
      const articles: ScrapedArticle[] = [];

      for (const item of feed.items ?? []) {
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        if (!isRecent(pubDate)) continue;

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

        const description = truncate(
          item.contentSnippet ||
            stripHtml(item.content ?? itemAny["content:encoded"] ?? "") ||
            item.summary ||
            ""
        );

        if (!item.title || !description) continue;

        articles.push({
          title: item.title.trim(),
          description,
          imageUrl,
          articleUrl: itemUrl,
          sourceName: feed.title || sourceName,
          publishedAt: pubDate,
        });
      }

      if (articles.length > 0) return articles;
    } catch {
      // Try next candidate
    }
  }

  return [];
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

    const links = new Set<string>();

    // Find article-like links
    $(
      'a[href*="/article"], a[href*="/news"], a[href*="/story"], a[href*="/post"], article a, h2 a, h3 a, .post-title a'
    ).each((_, el) => {
      const href = $(el).attr("href");
      if (href) links.add(resolveUrl(href, base));
    });

    const articles: ScrapedArticle[] = [];
    const toFetch = Array.from(links)
      .filter((l) => l.startsWith("http"))
      .slice(0, 15); // limit to 15 per source

    const results = await Promise.allSettled(
      toFetch.map((url) => scrapeArticleMeta(url, sourceName))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const article = result.value;
        if (isRecent(article.publishedAt)) {
          articles.push(article);
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

// Main export: scrape a single source URL
export async function scrapeSource(
  sourceUrl: string,
  sourceName: string
): Promise<ScrapedArticle[]> {
  // Try RSS first (fastest and most reliable)
  const rssArticles = await scrapeViaRSS(sourceUrl, sourceName);
  if (rssArticles.length > 0) return rssArticles;

  // Fall back to HTML scraping
  return scrapeViaHTML(sourceUrl, sourceName);
}

// Scrape all active sources
export async function scrapeAllSources(
  sources: { url: string; name: string }[]
): Promise<ScrapedArticle[]> {
  const results = await Promise.allSettled(
    sources.map((s) => scrapeSource(s.url, s.name))
  );

  const all: ScrapedArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
    }
  }

  // Deduplicate by URL, sort newest first
  const seen = new Set<string>();
  return all
    .filter((a) => {
      if (seen.has(a.articleUrl)) return false;
      seen.add(a.articleUrl);
      return true;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
