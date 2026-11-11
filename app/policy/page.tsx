import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Policies page: a single static template for every workspace. The
// workspace resolves from the request host, the same as every other
// public page, so Decatur, Effingham, and any future location get this
// page automatically with their own name and area filled in. Nothing is
// seeded per workspace; a new location launches with this page live.
export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getWorkspace();
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const url = `${base}/policy`;
  const title = "Policies";
  const description = `How ${workspace.name} handles your information, chooses what to publish, and runs advertising, explained in plain language.`;
  return {
    title: `${title} | ${workspace.name}`,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PolicyPage() {
  const ws = await getWorkspace();

  const sections: { heading: string; paragraphs: string[] }[] = [
    {
      heading: "Your privacy",
      paragraphs: [
        "To send the newsletter we collect your email address, and your name if you choose to give it. We also record how you found us (for example, a sponsor's link or a Facebook ad) so we know what is working.",
        "We measure opens and clicks on links in the email. That tells us which stories readers actually care about, and it is how we can honestly tell local sponsors what a placement is worth.",
        "We never sell or rent your email address or your information. Ever. It is not a product, and you are not the product.",
        "This website uses a Meta (Facebook) pixel to count signups that come from our ads. That is the only advertising tracking on the site.",
        "Every email has a one-click unsubscribe at the bottom. Leaving takes one click and no hard feelings. To ask what information we have about you, or to have it deleted, email us.",
      ],
    },
    {
      heading: "How we choose the news",
      paragraphs: [
        `The Gist is a curation newsletter. Each morning we read trusted local sources, pick the stories that matter most to ${ws.area}, and link directly to the original reporting. We do not rewrite other outlets' stories and pass them off as our own. Local journalism costs money to produce, and sending readers to the people who produced it is the point.`,
        "Stories we write ourselves are original reporting or community explainers, and we check claims about local people and businesses against an official source before publishing.",
        "If we get something wrong, we fix it. Email us about an error and we will correct it in the next issue and on the website where it appeared.",
      ],
    },
    {
      heading: "Advertising and sponsorships",
      paragraphs: [
        "Local businesses can list in our directory and promote events for free. Paid sponsorships exist too: featured campaigns, presenting partnerships, and paid posts on The Gist Board.",
        "Paid placements are labeled as sponsored. Paying for advertising never changes what news we cover, how we cover it, or what we say about a business. We do not sell endorsements, and a business you see advertised is a customer, not a partner in our coverage.",
        "The Gist Board is a community bulletin board. Anyone can pay $5 a week to post. Board posts are the poster's words, not ours, and we can decline or remove a post that is illegal, misleading, or not local, with a refund if it never ran.",
      ],
    },
    {
      heading: "Deals, products, and payments",
      paragraphs: [
        "The Gist Deals is a paid digital deals book, $15 a year for new buyers. Readers who bought under our earlier lifetime offer keep lifetime access; we keep our promises. Payments are processed by Stripe; we never see or store your card number.",
        "Physical products, like games we sell, are offered as preorders with clear delivery timing before you pay.",
        "Events listed on this site are submitted by organizers and community members. Public submissions are reviewed before they appear; we list the details the organizer provided and link out to the source.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Questions about any of this: email us at the address at the bottom of any issue. The Gist is run by Chad Williams, serving ${ws.area}.`,
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
            How The Gist works
          </h1>
          <p className="text-gray-600 leading-relaxed">
            {ws.name} is a free daily email newsletter. This page explains, in
            plain language, how we handle your information, how we choose what
            to publish, and how advertising works here. No fine print tricks.
            If anything here is unclear, email us and a real person will
            answer.
          </p>
        </div>

        {sections.map((s) => (
          <section key={s.heading} className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
              {s.heading}
            </h2>
            <div className="space-y-4">
              {s.paragraphs.map((p, i) => (
                <p key={`${s.heading}-${i}`} className="text-gray-600 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
