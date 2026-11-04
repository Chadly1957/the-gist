// Pure helpers for the Sponsor Amp Kit: the per-sponsor landing slug,
// the QR target URL, and the default kit email body. No imports, so this
// file is safe to use from both server code and the admin client UI.
// The server-side resolver and QR rendering live in lib/sponsor-kit.ts.
//
// Slug design (no DB column, derived forever): the canonical slug is
// slugify(businessName) + "-" + the first 6 chars of the profile id, so
// it is stable and collision-proof. The resolver (lib/sponsor-kit.ts)
// also accepts the plain slugified name when it matches exactly one
// profile in the workspace, which is the prettier form for hand-shared
// links; the suffixed form is canonical everywhere we generate a URL.

export interface SponsorSlugSource {
  id: string;
  businessName: string;
}

export function slugifyBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics after NFKD
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function sponsorPlainSlug(profile: SponsorSlugSource): string {
  return slugifyBusinessName(profile.businessName);
}

export function sponsorSlug(profile: SponsorSlugSource): string {
  const plain = sponsorPlainSlug(profile);
  const suffix = profile.id.slice(0, 6);
  return plain ? `${plain}-${suffix}` : suffix;
}

// The URL baked into the printed QR code: the canonical landing URL with
// the flyer UTMs attached, so a scan attributes to this sponsor even if
// the landing page's own defaults ever change.
export function sponsorQrTargetUrl(appUrl: string, slug: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/join/${slug}?utm_source=sponsor&utm_medium=flyer&utm_campaign=${slug}`;
}

export function sponsorLandingUrl(appUrl: string, slug: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/join/${slug}`;
}

// Default body for the kit email compose form. Plain text (the send route
// converts it to styled HTML the same way the sponsor email tool does).
// The admin edits it before sending; values are filled in for real.
export function defaultKitEmailBody(opts: {
  contactName: string;
  businessName: string;
  landingUrl: string;
  newsletterName: string;
  area: string;
}): string {
  const firstName = (opts.contactName || "").trim().split(/\s+/)[0] || "there";
  return `Hi ${firstName},

Thanks for being a ${opts.newsletterName} Community Partner. Attached is your partner kit: the flyer, your QR code, and graphics you can share.

Everything points to your own signup page:
${opts.landingUrl}

Anyone who joins through that link or QR code is credited to ${opts.businessName}, so we can show you exactly how many neighbors you brought in.

Easy ways to use it:
- Print the flyer and put it by the register or in the window.
- Share a graphic on Facebook or Instagram and paste your link with it.
- The QR code works on its own too: menus, receipts, table tents, anywhere.

Thanks for standing behind local news in ${opts.area}.

Chad
${opts.newsletterName}`;
}
