import SiteHeader from "@/components/SiteHeader";
import SponsorshipLanding from "@/components/sponsor/SponsorshipLanding";

export const dynamic = "force-dynamic";

// Sponsorship landing page (October 2026 freemium restructure): one
// combined-markets page served on both city domains. Leads with the free
// Business Directory signup; the two paid offers are the 7-Issue Featured
// Campaign and the Presenting Partnership.
export default function SponsorPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SponsorshipLanding />
    </div>
  );
}
