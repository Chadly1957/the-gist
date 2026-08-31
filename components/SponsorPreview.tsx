"use client";

export type SpotlightPreviewData = {
  type: "spotlight";
  businessName: string;
  logoUrl?: string;
  description: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type InArticlePreviewData = {
  type: "in_article";
  businessName?: string;
  imageUrl?: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type PresentingPreviewData = {
  type: "presenting";
  businessName?: string;
  imageUrl?: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  presentingBlurb?: string;
};

export type SponsorPreviewData = SpotlightPreviewData | InArticlePreviewData | PresentingPreviewData;

function SpotlightCard({ data }: { data: SpotlightPreviewData }) {
  return (
    <div style={{ padding: "20px 40px" }}>
      <div style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#6b7280", marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e5e7eb" }}>
        Community Partners
      </div>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12, borderCollapse: "separate" }}>
        <tbody>
          <tr>
            <td width={88} valign="top" style={{ padding: "14px 0 14px 14px" }}>
              {data.logoUrl ? (
                <img src={data.logoUrl} alt={data.businessName} width={72} height={72} style={{ display: "block", width: 72, height: 72, borderRadius: 6, objectFit: "contain", border: "1px solid #f3f4f6" }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 6, background: "#f3f4f6", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#9ca3af", textAlign: "center", lineHeight: 1.2 }}>No logo</div>
              )}
            </td>
            <td valign="middle" style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: "sans-serif", marginBottom: 4 }}>
                {data.businessName || <span style={{ color: "#9ca3af" }}>Business name</span>}
              </div>
              <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5, fontFamily: "sans-serif", marginBottom: 10 }}>
                {data.description || <span style={{ color: "#9ca3af" }}>Description will appear here.</span>}
              </div>
              <span style={{ display: "inline-block", background: "#146763", color: "#ffffff", padding: "7px 14px", borderRadius: 4, fontSize: 12, fontFamily: "sans-serif", fontWeight: 600, whiteSpace: "nowrap" }}>
                {data.ctaLabel || "Visit Website"}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function InArticleCard({ data }: { data: InArticlePreviewData }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", margin: "20px 40px", background: "#fafafa" }}>
      <div style={{ padding: "6px 14px", background: "#f3f4f6", fontFamily: "sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af" }}>
        Advertisement
      </div>
      {data.imageUrl ? (
        <img src={data.imageUrl} alt="" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: 150, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9ca3af" }}>
          Ad image will appear here
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: data.headline ? "#111827" : "#9ca3af", margin: "0 0 8px", fontFamily: "Georgia, serif", lineHeight: 1.3 }}>
          {data.headline || "Your Headline"}
        </div>
        <div style={{ fontSize: 14, color: data.body ? "#4b5563" : "#9ca3af", lineHeight: 1.6, margin: "0 0 14px", fontFamily: "sans-serif" }}>
          {data.body || "Your body copy will appear here."}
        </div>
        <span style={{ display: "inline-block", background: "#146763", color: "#ffffff", padding: "8px 18px", borderRadius: 4, fontSize: 13, fontFamily: "sans-serif", fontWeight: 600 }}>
          {data.ctaLabel || "Learn More"}
        </span>
      </div>
    </div>
  );
}

function PresentingCard({ data }: { data: PresentingPreviewData }) {
  return (
    <div style={{ padding: "20px 40px" }}>
      <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#854d0e", marginBottom: 8 }}>
          Presenting Sponsor
        </div>
        <p style={{ fontSize: 14, color: "#713f12", lineHeight: 1.6, fontFamily: "sans-serif", margin: 0 }}>
          {data.presentingBlurb || (
            <>Today&apos;s Gist Decatur is brought to you by <strong>{data.businessName || "Your Business"}</strong>.</>
          )}
        </p>
      </div>
      {data.imageUrl ? (
        <img src={data.imageUrl} alt="" style={{ maxWidth: "100%", height: "auto", display: "block", borderRadius: 6, marginBottom: 14 }} />
      ) : (
        <div style={{ width: "100%", height: 150, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9ca3af", borderRadius: 6, marginBottom: 14 }}>
          Ad image will appear here
        </div>
      )}
      <div style={{ fontSize: 18, fontWeight: 700, color: data.headline ? "#111827" : "#9ca3af", margin: "0 0 8px", fontFamily: "Georgia, serif", lineHeight: 1.3 }}>
        {data.headline || "Your Headline"}
      </div>
      <div style={{ fontSize: 14, color: data.body ? "#4b5563" : "#9ca3af", lineHeight: 1.6, margin: "0 0 14px", fontFamily: "sans-serif" }}>
        {data.body || "Your body copy will appear here."}
      </div>
      <span style={{ display: "inline-block", background: "#146763", color: "#ffffff", padding: "10px 20px", borderRadius: 4, fontSize: 13, fontFamily: "sans-serif", fontWeight: 600 }}>
        {data.ctaLabel || "Learn More"}
      </span>
    </div>
  );
}

export default function SponsorPreview({ data }: { data: SponsorPreviewData }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Email Preview</p>
      <div className="border border-gray-200 rounded-xl overflow-hidden" style={{ maxWidth: 580, background: "#ffffff" }}>
        <div className="flex items-center gap-1.5 bg-gray-50 border-b border-gray-200 px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-red-300" />
          <div className="w-2 h-2 rounded-full bg-yellow-300" />
          <div className="w-2 h-2 rounded-full bg-green-300" />
          <span className="ml-2 text-xs text-gray-400">How it looks in the newsletter</span>
        </div>
        {data.type === "spotlight" && <SpotlightCard data={data} />}
        {data.type === "in_article" && <InArticleCard data={data} />}
        {data.type === "presenting" && <PresentingCard data={data} />}
      </div>
    </div>
  );
}
