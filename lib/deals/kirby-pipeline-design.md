# Kirby Foods IGA — Weekly Vision Pipeline Design

## Problem
Kirby's weekly ad is not data. It's 3 JPG images on public S3
(clintoniga.s3.amazonaws.com/WeeklyAdPdfs/). No JSON API exists:
- Their AogGetWeeklyAds backend (wrapperapi.alwaysongrocery.net) is auth-gated (403/Forbidden).
- Not on Flipp flyerkit.
- S3 bucket listing is AccessDenied.
- Image filenames contain upload timestamps, so URLs change weekly and can't be guessed.

## v1 (done 2026-10-08)
Manual vision extraction: downloaded the 3 images, read them, structured 78 deals
into lib/deals/kirby-week-2026-10-07.ts, seeded as kirby-foods retailer (Effingham
only) via seedKirbyWeek, published. RetailerSeed supports onlyWorkspaces.

## Weekly automation design
1. **URL discovery** (browser task, ~2 min): visit
   https://www.kirbyfoods.com/weekly-ads/6/Kirby Foods Effingham, extract the
   3 ad image URLs from the DOM. Page renders client-side; plain HTTP can't do it.
2. **Download** (server/curl): S3 URLs are public, no auth. Save to workspace.
3. **Vision extraction** (agent): read each page image, extract structured deals
   (title, price, size, limits, category, digital-coupon notes). Proven accurate
   on the Oct 7-13 ad.
4. **Load**: create draft DealWeek for kirby-foods (reuse seedKirbyWeek pattern,
   parameterized by week), review, publish.

## Options for step 3
- **A (recommended): agent-in-the-loop.** A weekly cron wakes Walter with the image
  URLs; he extracts and loads. Zero API cost, proven quality. ~15 min/week.
- **B: vision API server-side.** Fetcher downloads images, calls Claude/OpenAI
  vision API, parses JSON into deals. Fully automatic but needs an API key in
  Vercel env + per-call cost (~$0.01-0.05/week). Needs prompt hardening +
  validation (stale-page detection: page 3 of the Oct 7 ad was dated Sep 11).

## Decision needed
Chad's call: option A (Walter does it weekly, free) or B (API key + full automation).
