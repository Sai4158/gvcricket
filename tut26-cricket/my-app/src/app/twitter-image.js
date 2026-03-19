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
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 20%, rgba(245, 158, 11, 0.14), transparent 28%), radial-gradient(circle at 50% 80%, rgba(239, 68, 68, 0.12), transparent 30%), linear-gradient(180deg, #080808 0%, #020202 100%)",
          color: "white",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 26,
            borderRadius: 36,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 26,
            width: "100%",
            height: "100%",
          }}
        >
          <img
            src={absoluteUrl(siteConfig.logoPath)}
            alt="GV Cricket"
            width="280"
            height="280"
            style={{
              objectFit: "contain",
              filter: "drop-shadow(0 18px 44px rgba(220, 38, 38, 0.26))",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.05em",
                color: "#ffffff",
              }}
            >
              GV Cricket
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                color: "#fbbf24",
              }}
            >
              GV Cricket 2.0
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
