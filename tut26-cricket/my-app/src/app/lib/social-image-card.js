/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { absoluteUrl, siteConfig } from "./site-metadata";

export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

export function createLogoOnlySocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at 50% 32%, rgba(220, 38, 38, 0.18), transparent 24%), radial-gradient(circle at 50% 72%, rgba(220, 38, 38, 0.1), transparent 28%), linear-gradient(180deg, #050505 0%, #000000 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 36,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />
        <img
          src={absoluteUrl(siteConfig.logoPath)}
          alt="GV Cricket"
          width="420"
          height="420"
          style={{
            position: "relative",
            objectFit: "contain",
            filter: "drop-shadow(0 22px 54px rgba(220, 38, 38, 0.28))",
          }}
        />
      </div>
    ),
    SOCIAL_IMAGE_SIZE
  );
}
