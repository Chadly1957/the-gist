import WorkspaceText from "@/components/workspace/WorkspaceText";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";
import SponsorsMarquee from "@/components/SponsorsMarquee";

export const dynamic = "force-dynamic";

export default async function SponsorPage() {
  const TIERS = [
    {
      key: "community",
      name: "Community Board",
      price: "Free",
      description:
        "Your business name, logo, one-line description, and link, rotating at the bottom of every newsletter. Accepted instantly, no payment needed.",
      includes: [
        "Business name, logo, and a one-line description",
        "Direct link to your website",
        "Rotates at the bottom of every issue",
      ],
      cta: "Join the Board",
      ctaHref: "/sponsor/community",
      highlight: false,
    },
    {
      key: "standard",
      name: "Standard Sponsor",
      price: "$75/week",
      description:
        "Your logo and a short write-up placed mid-email, running in every issue for a full week, Monday through Friday.",
      includes: [
        "Logo, short write-up, and link in every issue that week",
        "Mid-email placement, sized for attention",
        "Two Standard slots available each week",
      ],
      cta: "Book a Week",
      ctaHref: "/sponsor/apply?tier=standard",
      highlight: false,
    },
    {
      key: "presenting",
      name: "Presenting Sponsor",
      price: "$150/week",
      description:
        "The top sponsorship slot. Featured as the week's presenting sponsor at the very top of every issue, Monday through Friday.",
      includes: [
        "\"This issue is brought to you by [Your Business]\": top of the email",
        "Your logo, a short write-up, and link",
        "Exclusive: only 1 Presenting Sponsor per week",
      ],
      cta: "Book a Week",
      ctaHref: "/sponsor/apply?tier=presenting",
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-10 sm:py-16 text-center relative">
        <Link
          href="/"
          className="absolute top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back to Home</span>
        </Link>
        <Link href="/" className="flex items-center justify-center mb-5 sm:mb-6">
          <Logo className="h-12 sm:h-16 w-auto" />
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 text-gray-900"><WorkspaceText>{"Reach Decatur Every Day"}</WorkspaceText></h1>
        <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto"><WorkspaceText>{" Sponsor The Gist Decatur and put your business in front of engaged, local readers who care about their community. "}</WorkspaceText></p>
      </div>

      {/* Tiers */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.key}
              className={`rounded-2xl border p-6 flex flex-col ${
                tier.highlight
                  ? "border-green-500 shadow-lg shadow-green-100 ring-2 ring-green-500"
                  : "border-gray-200"
              }`}
            >
              {tier.highlight && (
                <span className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">
                  Most Impactful
                </span>
              )}
              <h2 className="text-lg font-bold text-gray-900 mb-1">{tier.name}</h2>
              <p className="text-2xl font-bold text-green-700 mb-3">{tier.price}</p>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{tier.description}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {tier.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaHref}
                className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  tier.highlight
                    ? "bg-green-700 text-white hover:bg-green-800"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <SponsorsMarquee />

        <p className="text-center text-sm text-gray-400 mt-10">
          Questions?{" "}
          <WorkspaceAnchor href="mailto:hello@thegistdecatur.com" className="text-green-700 hover:underline">
            Get in touch
          </WorkspaceAnchor>{" "}
          and we&apos;re happy to help you find the right fit.
        </p>
      </div>
    </div>
  );
}
