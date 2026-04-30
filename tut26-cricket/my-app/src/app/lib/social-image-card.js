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

function resolveSocialImageUrl(url = "", baseUrl = "") {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) {
    return "";
  }

  try {
    return new URL(cleanUrl, baseUrl || absoluteUrl("/")).toString();
  } catch {
    return cleanUrl;
  }
}

function getShareableResultImages(match = null, baseUrl = "") {
  const images = Array.isArray(match?.matchImages)
    ? match.matchImages
        .filter((image) => image?.url)
        .slice(0, 4)
        .map((image) => ({
          ...image,
          url: resolveSocialImageUrl(image.url, baseUrl),
        }))
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

  const renderSlot = (image, style, width, height) => (
    <div
      key={image.id || image.url}
      style={{
        position: "absolute",
        overflow: "hidden",
        display: "flex",
        ...style,
      }}
    >
      <img
        src={image.url}
        alt=""
        width={width}
        height={height}
        style={{
          width,
          height,
          objectFit: "cover",
        }}
      />
    </div>
  );

  if (collageImages.length === 2) {
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 630,
          display: "flex",
        }}
      >
        {renderSlot(collageImages[0], { left: 0, top: 0, width: 600, height: 630 }, 600, 630)}
        {renderSlot(collageImages[1], { left: 600, top: 0, width: 600, height: 630 }, 600, 630)}
      </div>
    );
  }

  if (collageImages.length === 3) {
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 630,
          display: "flex",
        }}
      >
        {renderSlot(collageImages[0], { left: 0, top: 0, width: 690, height: 630 }, 690, 630)}
        {renderSlot(collageImages[1], { left: 690, top: 0, width: 510, height: 315 }, 510, 315)}
        {renderSlot(collageImages[2], { left: 690, top: 315, width: 510, height: 315 }, 510, 315)}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1200,
        height: 630,
        display: "flex",
      }}
    >
      {renderSlot(collageImages[0], { left: 0, top: 0, width: 600, height: 315 }, 600, 315)}
      {renderSlot(collageImages[1], { left: 600, top: 0, width: 600, height: 315 }, 600, 315)}
      {renderSlot(collageImages[2], { left: 0, top: 315, width: 600, height: 315 }, 600, 315)}
      {renderSlot(collageImages[3], { left: 600, top: 315, width: 600, height: 315 }, 600, 315)}
    </div>
  );
}

export function createResultSocialImage(match = null, options = {}) {
  const logoSource = getEmbeddedLogoSource();
  const winningSummary = getWinningInningsSummary(match);
  const shareImages = getShareableResultImages(match, options.baseUrl);
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
            display: "flex",
            background: usePhotoCollage
              ? "linear-gradient(180deg, rgba(4,6,10,0.18), rgba(4,6,10,0.55) 34%, rgba(4,6,10,0.84) 100%)"
              : "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 26%), linear-gradient(180deg, rgba(4,6,10,0.9), rgba(4,6,10,0.98))",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 28,
            display: "flex",
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
                display: "flex",
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
                display: "flex",
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

function resolveSessionIndexShareImages(sessions = [], baseUrl = "") {
  return (Array.isArray(sessions) ? sessions : [])
    .filter((session) => Array.isArray(session?.matchImages) && session.matchImages.length >= 2)
    .map((session) => {
      const firstImage = session.matchImages.find((image) => image?.url);
      if (!firstImage?.url) {
        return null;
      }

      return {
        id: session._id || firstImage.id || firstImage.url,
        url: resolveSocialImageUrl(firstImage.url, baseUrl),
        title: buildMatchupText(session),
        scoreline: `${Number(session?.score || 0)}/${Number(session?.outs || 0)}`,
        result: cleanText(session?.result || ""),
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function buildSessionIndexHeadline(sessions = []) {
  const count = Math.max(0, Number(sessions?.length || 0));
  if (!count) {
    return "Latest games and results.";
  }
  if (count === 1) {
    return "Latest live game and result.";
  }
  return `Latest ${count} cricket sessions.`;
}

export function createSessionsIndexSocialImage(sessions = [], options = {}) {
  const shareImages = resolveSessionIndexShareImages(sessions, options.baseUrl);
  if (!shareImages.length) {
    return createLogoOnlySocialImage();
  }

  const cards = shareImages.slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(245,158,11,0.14), transparent 26%), linear-gradient(180deg, #05070a 0%, #020304 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 28,
            display: "flex",
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,0.09)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
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
            padding: "40px 42px",
            color: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 18,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                GV Cricket
              </span>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 900,
                  lineHeight: 1.02,
                }}
              >
                Sessions and Results
              </span>
              <span
                style={{
                  fontSize: 24,
                  color: "rgba(255,255,255,0.84)",
                }}
              >
                {buildSessionIndexHeadline(cards)}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: cards.length >= 3 ? "1fr 1fr" : `repeat(${cards.length}, 1fr)`,
              gap: 18,
              flex: 1,
            }}
          >
            {cards.map((card) => (
              <div
                key={card.id}
                style={{
                  position: "relative",
                  display: "flex",
                  overflow: "hidden",
                  borderRadius: 28,
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(10,12,18,0.28)",
                  minHeight: cards.length <= 2 ? 320 : 210,
                }}
              >
                <img
                  src={card.url}
                  alt=""
                  width="540"
                  height="320"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(6,8,12,0.1), rgba(6,8,12,0.34) 46%, rgba(6,8,12,0.88) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    gap: 8,
                    width: "100%",
                    padding: "18px 20px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      lineHeight: 1.08,
                    }}
                  >
                    {card.title}
                  </span>
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    {card.scoreline}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      color: "rgba(255,255,255,0.86)",
                    }}
                  >
                    {card.result || "Live score available"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    SOCIAL_IMAGE_SIZE
  );
}


