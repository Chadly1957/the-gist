"use client";

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

export default function SponsorsMarquee() {
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);

  useEffect(() => {
    fetch("/api/spotlights")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSpotlights(data);
      })
      .catch(() => {});
  }, []);

  if (spotlights.length === 0) return null;

  const items = spotlights.length < 4 ? [...spotlights, ...spotlights, ...spotlights] : spotlights;
  const doubled = [...items, ...items];

  return (
    <section className="py-10 border-y border-gray-100 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center">
          Community Partners
        </p>
      </div>
      <div className="relative overflow-hidden">
        <div className="flex gap-8 w-max animate-marquee">
          {doubled.map((s, i) => (
            <a
              key={`${s.id}-${i}`}
              href={s.ctaUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl px-6 py-4 hover:border-green-200 hover:bg-green-50 transition-colors shrink-0"
            >
              {s.logoUrl ? (
                <Image
                  src={s.logoUrl}
                  alt={s.businessName}
                  width={42}
                  height={42}
                  className="w-10 h-10 object-contain rounded"
                  unoptimized
                />
              ) : (
                <div className="w-10 h-10 rounded bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-700 font-bold text-base">
                    {s.businessName.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-base font-semibold text-gray-800 whitespace-nowrap">
                {s.businessName}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
