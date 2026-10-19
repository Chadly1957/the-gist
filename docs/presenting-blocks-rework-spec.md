# Presenting blocks rework — build spec

Date: 2026-10-16. Source: Chad's to-do list ("rework presenting sponsorship and
template block / make another logo only presenting template block / make other
blocks editable with a field of 'Presented By'").

## What Chad wants

1. **A new logo-only presenting template block.** Same auto-filled presenting
   sponsor data as the existing `presenting_sponsor` block, but renders only a
   compact "Presented by [logo]" strip instead of the full headline/body/CTA
   treatment. For newsletters where the partner just wants the logo strip.
2. **An editable "Presented By" field on the sponsor blocks.** Today
   `presenting_sponsor` and `spotlight` show "No configuration needed" in the
   block editor and auto-populate with zero configurability. Chad wants to type
   a custom label per block instance (e.g. "Presented by Buena Vista National
   Bank") that overrides the default eyebrow/header text at render time.

## Design

### New block type: `presenting_sponsor_logo`

- **Data source:** identical to `presenting_sponsor` — the approved presenting
  sponsor resolved for the newsletter date (`PresentingSponsorItem`:
  businessName, logoUrl, ctaUrl). Hidden (renders `""`) when no sponsor is
  booked, same as the existing block.
- **Render** (`renderPresentingSponsorLogo` in `lib/template-renderer.ts`):
  a slim strip, e.g.
  ```
  <div style="padding:12px 40px;">
    <div style="font-family:sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#854d0e;margin-bottom:8px;">{presentedBy || "Presented by"}</div>
    <a href="{tracked ctaUrl}"><img src="{logoUrl}" alt="{businessName}" style="max-height:56px;..." /></a>
  </div>
  ```
  Fallbacks: if `logoUrl` is missing, render the business name as styled text
  instead of an img. If `ctaUrl` is missing, render the logo unlinked. If no
  sponsor is booked, render nothing.
- **Tracking:** use the same `trackedUrl(tracking, ctaUrl, "presenting_sponsor_logo", businessName)` helper.

### Editable `presentedBy` field

Add an optional `presentedBy: string` content field to three block types:
`presenting_sponsor`, `presenting_sponsor_logo`, and `spotlight`.

Render behavior when `presentedBy` is set (trimmed, non-empty):
- `presenting_sponsor`: the yellow-box eyebrow "Presenting Sponsor" becomes the
  custom label verbatim (e.g. "Presented by Buena Vista National Bank"). The
  blurb line ("Today's Gist is brought to you by …") is unchanged.
- `presenting_sponsor_logo`: the strip label becomes the custom label verbatim
  (default: "Presented by").
- `spotlight`: the "Community Partners" section header becomes the custom label
  verbatim. (Open question for Chad below.)

When unset/empty, everything renders exactly as it does today. Fully
backward-compatible with existing saved templates.

## Files to change

### 1. `lib/template-renderer.ts`
- Add `"presenting_sponsor_logo"` to the `Block["type"]` union (line 5).
- Add `renderPresentingSponsorLogo(item: PresentingSponsorItem, tracking?: TrackingConfig, presentedBy?: string)` per the design above.
- In `renderTemplate`'s block switch (around line 670): add
  `case "presenting_sponsor_logo": return presentingSponsor ? renderPresentingSponsorLogo(presentingSponsor, tracking, block.content.presentedBy as string) : "";`
- In the existing `case "presenting_sponsor"`, pass
  `block.content.presentedBy` through so the eyebrow can be overridden.
- In `renderSpotlight`, accept an optional `presentedBy` param; use it in place
  of the "Community Partners" header when set.

### 2. `components/admin/BlockEditor.tsx`
- Add `"presenting_sponsor_logo"` to the `Block["type"]` union (line 11).
- Add to `BLOCK_TYPES`: `{ type: "presenting_sponsor_logo", label: "Presenting Sponsor (Logo Only)", icon: "✦" }`.
- Add to `defaults` in `addBlock`: `presenting_sponsor_logo: { presentedBy: "" }`;
  change `presenting_sponsor: {}` → `presenting_sponsor: { presentedBy: "" }`
  and `spotlight: {}` → `spotlight: { presentedBy: "" }`.
- Replace the "No configuration needed" summary for `presenting_sponsor`
  (line ~665) with a small edit form: a labeled text input "Presented by
  (optional)" bound to `block.content.presentedBy`, plus the existing
  auto-populate note. Do the same for the new logo block and for `spotlight`.
- Update the block-list summaries (lines ~302-326) to show the custom label
  when set, e.g. `Presenting Sponsor (Logo) — "Presented by …"` or the default
  description when empty.

### 3. Compose page
Check `app/admin/compose/page.tsx` — it reuses the shared `BlockEditor`, so no
change should be needed, but verify the new block type renders in the compose
preview.

## Acceptance
- New "Presenting Sponsor (Logo Only)" block appears in the block picker,
  renders the booked sponsor's logo strip in template preview, hides when no
  sponsor is booked.
- Typing a "Presented by" label on any of the three blocks changes only that
  block's header text in preview and in sent mail; empty = today's rendering.
- Existing saved templates (with `{}` content on these blocks) render
  unchanged — no migration needed since `presentedBy` is optional.

## Open question for Chad (confirm before building)
For the `spotlight` (Community Partners) block, should the custom label
**replace** the "Community Partners" header, or **append** to it
(e.g. "Community Partners · Presented by X")? Spec assumes replace; say the
word if you want append.
