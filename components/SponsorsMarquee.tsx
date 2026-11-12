"use client";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";
import Link from "@/components/workspace/WorkspaceLink";

import { workspaceFetch } from "@/lib/workspace-client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Spotlight {
  id: string;
  businessName: string;
  logoUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  description: string | null;
}

interface SponsorsMarqueeProps {
  // Band variant (homepage only): renders the marquee inside a white
  // featured-partner panel with an eyebrow, heading, and copy. When
  // omitted, the marquee renders exactly as before (used by /join).
  band?: boolean;
  eyebrow?: string;
  heading?: string;
  copy?: string;
}

export default function SponsorsMarquee({ band = false, eyebrow, heading, copy }: SponsorsMarqueeProps = {}) {
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);

  useEffect(() => {
    workspaceFetch("/api/spotlights")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSpotlights(data);
      })
      .catch(() => {});
  }, []);

  if (spotlights.length === 0) return null;

  const items = spotlights.length < 4 ? [...spotlights, ...spotlights, ...spotlights] : spotlights;
  const doubled = [...items, ...items];

  const marquee = (
    <>
      <div className="relative overflow-hidden">
        <div className="flex gap-12 w-max animate-marquee">
          {doubled.map((s, i) => (
            <WorkspaceAnchor
              key={`${s.id}-${i}`}
              href={s.ctaUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-6 bg-gray-50 border border-gray-100 rounded-xl px-9 py-6 hover:border-green-200 hover:bg-green-50 transition-colors shrink-0"
            >
              {s.logoUrl ? (
                <Image
                  src={s.logoUrl}
                  alt={s.businessName}
                  width={60}
                  height={60}
                  className="w-16 h-16 object-contain rounded"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 rounded bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-700 font-bold text-2xl">
                    {s.businessName.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-2xl font-semibold text-gray-800 whitespace-nowrap">
                {s.businessName}
              </span>
            </WorkspaceAnchor>
          ))}
        </div>
      </div>
      <div className="mt-6 text-center">
        <Link href="/partners" className="text-sm font-semibold text-green-700 hover:underline">
          See all our Community Partners →
        </Link>
      </div>
    </>
  );

  if (band) {
    return (
      <section className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm px-4 py-10 sm:px-8 overflow-hidden">
            <div className="text-center mb-8 px-4">
              {eyebrow && (
                <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                  {heading}
                </h2>
              )}
              {copy && (
                <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
                  {copy}
                </p>
              )}
            </div>
            {marquee}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 border-y border-gray-100 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center">
          Community Partners
        </p>
      </div>
      {marquee}
    </section>
  );
}
