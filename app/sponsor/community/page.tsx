import { permanentRedirect } from "next/navigation";

// The standalone Community Board signup is retired (2026-11-12): /sponsor
// is now the single signup flow — the free-listing form there has the logo
// upload inline and the newsletter opt-in. Keep the old URL working for
// bookmarks, indexed links, and anything still pointing here.
export default function CommunityRedirect() {
  permanentRedirect("/sponsor#free-signup");
}
