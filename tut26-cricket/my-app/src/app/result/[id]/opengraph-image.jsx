/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { absoluteUrl, getMatchupLabel, siteConfig } from "../../lib/site-metadata";
import { loadPublicMatchData } from "../../lib/server-data";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage({ params }) {
  const { id } = await params;
  const match = await loadPublicMatchData(id);
  const matchup = getMatchupLabel({
    sessionName: "",
    teamAName: match?.teamAName,
    teamBName: match?.teamBName,
  });
  const score = `${match?.score ?? 0}/${match?.outs ?? 0}`;
  const result = match?.result || "Match result available";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(circle at top left, rgba(255,191,36,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(255,82,130,0.14), transparent 30%), linear-gradient(135deg, #120406 0%, #09090d 48%, #050507 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: 34,
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "100%",
              padding: "56px 62px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <img
                  src={absoluteUrl(siteConfig.logoPath)}
                  alt="GV Cricket"
                  width="86"
                  height="86"
                  style={{ borderRadius: 24 }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 20px",
                    borderRadius: 999,
                    fontSize: 22,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    background: "rgba(250,204,21,0.12)",
                    border: "1px solid rgba(250,204,21,0.22)",
                    color: "#fcd34d",
                  }}
                >
                  Match Result
                </div>
              </div>
              <div
                style={{
                  fontSize: 58,
                  fontWeight: 700,
                  lineHeight: 1.04,
                  maxWidth: 760,
                }}
              >
                {matchup}
              </div>
              <div
                style={{
                  fontSize: 28,
                  color: "rgba(255,255,255,0.76)",
                  maxWidth: 760,
                }}
              >
                Final score, result, and match insights from GV Cricket.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                justifyContent: "space-between",
                gap: 28,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "28px 30px",
                  minWidth: 300,
                  borderRadius: 28,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Final score
                </div>
                <div
                  style={{
                    fontSize: 62,
                    fontWeight: 700,
                    color: "#f8fafc",
                  }}
                >
                  {score}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 10,
                  padding: "28px 30px",
                  flex: 1,
                  borderRadius: 28,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  fontSize: 30,
                  color: "#f8fafc",
                }}
              >
                <div>{result}</div>
                <div style={{ color: "#fcd34d", fontSize: 24 }}>
                  Share the result card, score, and stats instantly.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
