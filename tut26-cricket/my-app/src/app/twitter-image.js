/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { absoluteUrl, siteConfig } from "./lib/site-metadata";

export const runtime = "nodejs";
export const alt = "GV Cricket";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background:
            "radial-gradient(circle at top left, rgba(255,164,83,0.22), transparent 28%), linear-gradient(135deg, #190505 0%, #09090d 42%, #050507 100%)",
          color: "white",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 32,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 72px 64px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
              }}
            >
              <img
                src={absoluteUrl(siteConfig.logoPath)}
                alt="GV Cricket"
                width="96"
                height="96"
                style={{ borderRadius: 26 }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "#fde68a",
                  }}
                >
                  GV Cricket
                </div>
                <div
                  style={{
                    fontSize: 54,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  Free Cricket Scoring
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                lineHeight: 1.05,
                maxWidth: 900,
              }}
            >
              Score every match with one fast mobile flow.
            </div>

            <div
              style={{
                fontSize: 32,
                lineHeight: 1.4,
                color: "rgba(255,255,255,0.82)",
                maxWidth: 860,
              }}
            >
              Live score, umpire mode, spectator view, score announcer, walkie-talkie, and results.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: "rgba(255,255,255,0.76)",
                fontSize: 24,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: "#22c55e",
                }}
              />
              gvcricket.com
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
