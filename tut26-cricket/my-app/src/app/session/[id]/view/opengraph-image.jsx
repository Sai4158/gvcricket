/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { getMatchupLabel } from "../../../lib/site-metadata";
import { loadSessionViewData } from "../../../lib/server-data";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage({ params }) {
  const { id } = await params;
  const initialData = await loadSessionViewData(id);
  const session = initialData?.session || {};
  const match = initialData?.match || {};
  const matchup = getMatchupLabel({
    sessionName: session.name,
    teamAName: match.teamAName || session.teamAName,
    teamBName: match.teamBName || session.teamBName,
  });
  const score = `${match?.score ?? 0}/${match?.outs ?? 0}`;
  const legalBalls = match?.balls?.filter((ball) => !ball.isExtra).length || 0;
  const overText = `${match?.innings === "second" ? "Second innings" : "Live score"} | ${
    legalBalls ? `${(legalBalls / 6).toFixed(1)} overs` : "0.0 overs"
  }`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(circle at top right, rgba(0,229,255,0.14), transparent 28%), radial-gradient(circle at bottom left, rgba(255,82,130,0.16), transparent 32%), linear-gradient(135deg, #100406 0%, #09090d 46%, #050507 100%)",
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
              position: "absolute",
              inset: 0,
              borderRadius: 34,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
            }}
          />
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
                  src="https://gvcricket.com/gvLogo.png"
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
                    background: "rgba(0,230,118,0.12)",
                    border: "1px solid rgba(0,230,118,0.22)",
                    color: "#86efac",
                  }}
                >
                  Live Spectator View
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
                Follow the live score, wickets, and match updates in GV Cricket.
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
                  Live score
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
                  fontSize: 28,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                <div>{overText}</div>
                <div style={{ color: "#facc15" }}>
                  Score updates, announcer, and spectator view in one app.
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
