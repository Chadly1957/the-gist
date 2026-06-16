import Link from "next/link";
import { prisma } from "@/lib/db";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

const TIER_DEFAULTS = {
  spotlight: "Free",
  in_article: "$15/day",
  presenting: "$25/day",
};

async function getPrices() {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ["sponsorship_price_spotlight", "sponsorship_price_in_article", "sponsorship_price_presenting"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      spotlight: map["sponsorship_price_spotlight"] || TIER_DEFAULTS.spotlight,
      in_article: map["sponsorship_price_in_article"] || TIER_DEFAULTS.in_article,
      presenting: map["sponsorship_price_presenting"] || TIER_DEFAULTS.presenting,
    };
  } catch {
    return TIER_DEFAULTS;
  }
}

export default async function SponsorPage() {
  const prices = await getPrices();

  const TIERS = [
    {
      key: "spotlight",
      name: "Small Business Spotlight",
      price: prices.spotlight,
      description:
        "Get your business in front of Decatur readers every week. Your listing rotates in a group of up to 5 local businesses and appears in every newsletter we send.",
      includes: [
        "Your logo, business name, and a 1–2 sentence description",
        "A direct link to your website",
        "Rotating placement — everyone gets equal visibility",
      ],
      cta: "Apply for Free",
      highlight: false,
    },
    {
      key: "in_article",
      name: "In-Article Sponsorship",
      price: prices.in_article,
      description:
        "Your message appears inline with the day's news, labeled as a sponsored post. Choose any available dates on the calendar.",
      includes: [
        "Custom image, headline, and up to 250 characters of body copy",
        "A call-to-action link",
        "Up to 2 in-article slots per day",
      ],
      cta: "Reserve Dates",
      highlight: false,
    },
    {
      key: "presenting",
      name: "Presenting Sponsor",
      price: prices.presenting,
      description:
        "The top sponsorship slot. You're featured as the day's presenting sponsor with a mention in the opening, plus a full in-article placement — outside the 2-slot limit.",
      includes: [
        "\"Today's Gist is brought to you by [Your Business]\" opening mention",
        "Full in-article ad placement (does not count against the 2-slot cap)",
        "Exclusive — only 1 presenting sponsor per day",
      ],
      cta: "Reserve Dates",
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-green-900 text-white px-6 py-16 text-center">
        <div className="flex items-center justify-center mb-6">
          <Logo className="h-8 w-auto" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Reach Decatur Every Day</h1>
        <p className="text-green-200 text-lg max-w-xl mx-auto">
          Sponsor The Gist Decatur and put your business in front of engaged, local readers who care about their community.
        </p>
      </div>

      {/* Tiers */}
      <div className="max-w-5xl mx-auto px-6 py-16">
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
                href="/sponsor/apply"
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

        <p className="text-center text-sm text-gray-400 mt-10">
          Questions?{" "}
          <a href="mailto:hello@thegistdecatur.com" className="text-green-700 hover:underline">
            Get in touch
          </a>{" "}
          — we&apos;re happy to help you find the right fit.
        </p>
      </div>
    </div>
  );
}
