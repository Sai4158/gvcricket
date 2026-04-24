/**
 * File overview:
 * Purpose: Provides shared Social Image Card logic for routes, APIs, and feature code.
 * Main exports: createLogoOnlySocialImage, SOCIAL_IMAGE_SIZE.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

/* eslint-disable @next/next/no-img-element */
import path from "node:path";
import { readFileSync } from "node:fs";
import { ImageResponse } from "next/og";
import { getWinningInningsSummary } from "./match-result-display";
import {
  absoluteUrl,
  cleanText,
  siteConfig,
} from "./site-metadata";

export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

let embeddedLogoDataUrl = null;

function getEmbeddedLogoSource() {
  if (embeddedLogoDataUrl) {
    return embeddedLogoDataUrl;
  }

  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      (siteConfig.shareLogoPath || siteConfig.logoPath).replace(/^\//, "")
    );
    const logoBuffer = readFileSync(logoPath);
    embeddedLogoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    return embeddedLogoDataUrl;
  } catch {
    return absoluteUrl(siteConfig.shareLogoPath || siteConfig.logoPath);
  }
}

export function createLogoOnlySocialImage() {
  const logoSource = getEmbeddedLogoSource();

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
        <div
          style={{
            position: "absolute",
            width: 900,
            height: 520,
            borderRadius: 48,
            background:
              "radial-gradient(circle at 50% 44%, rgba(255, 58, 58, 0.26), rgba(255, 58, 58, 0.08) 36%, rgba(0, 0, 0, 0) 76%)",
            filter: "blur(18px)",
          }}
        />
        <img
          src={logoSource}
          alt="GV Cricket"
          width="860"
          height="646"
          style={{
            position: "relative",
            objectFit: "contain",
            filter: "drop-shadow(0 24px 62px rgba(220, 38, 38, 0.34))",
          }}
        />
      </div>
    ),
    SOCIAL_IMAGE_SIZE
  );
}

function getShareableResultImages(match = null) {
  const images = Array.isArray(match?.matchImages)
    ? match.matchImages.filter((image) => image?.url).slice(0, 4)
    : [];

  return images.length >= 2 ? images : [];
}

function buildResultHeadline(match = null) {
  const resultText = cleanText(match?.result || "");
  if (resultText) {
    return resultText;
  }

  const winningSummary = getWinningInningsSummary(match);
  if (winningSummary?.teamName) {
    return `${winningSummary.teamName} took the match.`;
  }

  return "Match result ready.";
}

function buildMatchupText(match = null) {
  const teamAName = cleanText(match?.teamAName || match?.innings1?.team || "Team A");
  const teamBName = cleanText(match?.teamBName || match?.innings2?.team || "Team B");
  return `${teamAName} vs ${teamBName}`;
}

function buildResultSubline(match = null) {
  const winningSummary = getWinningInningsSummary(match);
  if (winningSummary?.teamName) {
    return `${winningSummary.teamName} finished on ${winningSummary.scoreline} in ${winningSummary.overs} overs.`;
  }

  return "Final score, winner, and match stats are available.";
}

function buildCollageLayout(images = []) {
  const collageImages = images.slice(0, 4);

  if (collageImages.length === 2) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {collageImages.map((image) => (
          <div
            key={image.id || image.url}
            style={{ position: "relative", overflow: "hidden" }}
          >
            <img
              src={image.url}
              alt=""
              width="600"
              height="630"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (collageImages.length === 3) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "1.15fr 0.85fr",
        }}
      >
        <div style={{ position: "relative", overflow: "hidden" }}>
          <img
            src={collageImages[0].url}
            alt=""
            width="690"
            height="630"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
          }}
        >
          {collageImages.slice(1).map((image) => (
            <div
              key={image.id || image.url}
              style={{ position: "relative", overflow: "hidden" }}
            >
              <img
                src={image.url}
                alt=""
                width="510"
                height="315"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
      }}
    >
      {collageImages.map((image) => (
        <div
          key={image.id || image.url}
          style={{ position: "relative", overflow: "hidden" }}
        >
          <img
            src={image.url}
            alt=""
            width="600"
            height="315"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ))}
    </div>
  );
}

export function createResultSocialImage(match = null) {
  const logoSource = getEmbeddedLogoSource();
  const winningSummary = getWinningInningsSummary(match);
  const shareImages = getShareableResultImages(match);
  const usePhotoCollage = shareImages.length >= 2;
  const matchupText = buildMatchupText(match);
  const headlineText = buildResultHeadline(match);
  const sublineText = buildResultSubline(match);
  const scoreline = winningSummary?.scoreline || cleanText(`${match?.score || 0}/${match?.outs || 0}`);
  const overs = winningSummary?.overs || "0.0";
  const photoBadgeText = `${shareImages.length} match photos`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at top, rgba(59,130,246,0.22), transparent 28%), radial-gradient(circle at bottom right, rgba(251,113,133,0.16), transparent 30%), linear-gradient(180deg, #05070a 0%, #020304 100%)",
        }}
      >
        {usePhotoCollage ? buildCollageLayout(shareImages) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: usePhotoCollage
              ? "linear-gradient(180deg, rgba(4,6,10,0.18), rgba(4,6,10,0.55) 34%, rgba(4,6,10,0.84) 100%)"
              : "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 26%), linear-gradient(180deg, rgba(4,6,10,0.9), rgba(4,6,10,0.98))",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,0.09)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 70px rgba(0,0,0,0.34)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "40px 48px",
            color: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <img
                src={logoSource}
                alt="GV Cricket"
                width="76"
                height="76"
                style={{
                  width: 76,
                  height: 76,
                  objectFit: "contain",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  padding: 8,
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.76)",
                  }}
                >
                  Share Result
                </span>
                <span
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    lineHeight: 1.05,
                  }}
                >
                  {matchupText}
                </span>
              </div>
            </div>
            {usePhotoCollage ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(10,12,18,0.4)",
                  padding: "10px 18px",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {photoBadgeText}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: 840,
            }}
          >
            <div
              style={{
                fontSize: 54,
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
              }}
            >
              {headlineText}
            </div>
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.88)",
              }}
            >
              {sublineText}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minWidth: 220,
                padding: "18px 22px",
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(8,10,14,0.44)",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.62)",
                }}
              >
                Winning Score
              </span>
              <span
                style={{
                  fontSize: 50,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {scoreline}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minWidth: 180,
                padding: "18px 22px",
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(8,10,14,0.44)",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.62)",
                }}
              >
                Overs
              </span>
              <span
                style={{
                  fontSize: 50,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {overs}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    SOCIAL_IMAGE_SIZE
  );
}


