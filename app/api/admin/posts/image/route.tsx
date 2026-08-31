import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GREEN = "#146763";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { searchParams, origin } = new URL(req.url);
  const headline = searchParams.get("headline") || "Headline";
  const excerpt = searchParams.get("excerpt") || "";
  const source = searchParams.get("source") || "";
  const date = searchParams.get("date") || "";
  const imageUrl = searchParams.get("imageUrl") || "";
  const cta = searchParams.get("cta") || "Read More →";
  const format = searchParams.get("format") || "square";

  const isLandscape = format === "landscape";
  const width = isLandscape ? 1200 : 1080;
  const height = isLandscape ? 630 : 1080;
  const logoUrl = `${origin}/the-gist-logo.png`;

  const imagePlaceholder = (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#e5e7eb",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "#9ca3af", fontSize: 28 }}>No image</span>
    </div>
  );

  if (isLandscape) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "white",
            fontFamily: "sans-serif",
          }}
        >
          {/* Left: article image */}
          <div style={{ display: "flex", width: 560, flexShrink: 0, overflow: "hidden" }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              imagePlaceholder
            )}
          </div>

          {/* Right: content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "44px 48px",
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
              <img src={logoUrl} height={56} style={{ objectFit: "contain" }} />
            </div>

            {/* Green divider */}
            <div
              style={{
                display: "flex",
                height: 3,
                background: GREEN,
                marginBottom: 28,
                borderRadius: 2,
              }}
            />

            {/* Source + date */}
            {(source || date) && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                {source && (
                  <span
                    style={{
                      color: GREEN,
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {source}
                  </span>
                )}
                {source && date && (
                  <span style={{ color: "#9ca3af", fontSize: 13 }}>•</span>
                )}
                {date && <span style={{ color: "#9ca3af", fontSize: 13 }}>{date}</span>}
              </div>
            )}

            {/* Headline */}
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.25,
                marginBottom: 16,
              }}
            >
              {headline}
            </div>

            {/* Excerpt */}
            {excerpt && (
              <div
                style={{
                  display: "flex",
                  fontSize: 15,
                  color: "#6b7280",
                  lineHeight: 1.6,
                  flex: 1,
                }}
              >
                {excerpt}
              </div>
            )}

            {/* CTA */}
            {cta && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <div
                  style={{
                    background: GREEN,
                    color: "white",
                    padding: "12px 28px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {cta}
                </div>
              </div>
            )}
          </div>
        </div>
      ),
      { width, height }
    );
  }

  // Square layout
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header: logo */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "28px 60px",
            borderBottom: `4px solid ${GREEN}`,
          }}
        >
          <img src={logoUrl} height={60} style={{ objectFit: "contain" }} />
        </div>

        {/* Article image */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            imagePlaceholder
          )}
        </div>

        {/* Bottom content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "32px 48px 36px",
            background: "white",
          }}
        >
          {/* Source + date */}
          {(source || date) && (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              {source && (
                <span
                  style={{
                    color: GREEN,
                    fontWeight: 700,
                    fontSize: 16,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {source}
                </span>
              )}
              {source && date && (
                <span style={{ color: "#9ca3af", fontSize: 16 }}>•</span>
              )}
              {date && <span style={{ color: "#9ca3af", fontSize: 16 }}>{date}</span>}
            </div>
          )}

          {/* Headline */}
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              color: "#111827",
              lineHeight: 1.2,
              marginBottom: excerpt ? 14 : 20,
            }}
          >
            {headline}
          </div>

          {/* Excerpt */}
          {excerpt && (
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "#6b7280",
                lineHeight: 1.55,
                marginBottom: 20,
              }}
            >
              {excerpt}
            </div>
          )}

          {/* CTA */}
          {cta && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  background: GREEN,
                  color: "white",
                  padding: "14px 32px",
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {cta}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { width, height }
  );
}
