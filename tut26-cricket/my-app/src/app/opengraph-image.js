import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "GV Cricket - free cricket scoring app";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
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
            padding: "72px 72px 64px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: 999,
                fontSize: 22,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                border: "1px solid rgba(255,217,119,0.18)",
                background: "rgba(255,217,119,0.08)",
                color: "#fde68a",
              }}
            >
              GV Cricket
            </div>
            <div
              style={{
                fontSize: 74,
                fontWeight: 700,
                lineHeight: 1.05,
                maxWidth: 860,
              }}
            >
              Free cricket scoring, made simple.
            </div>
            <div
              style={{
                fontSize: 32,
                lineHeight: 1.4,
                color: "rgba(255,255,255,0.82)",
                maxWidth: 860,
              }}
            >
              Live score, umpire mode, spectator view, score announcer, walkie-talkie, and results in one mobile-friendly app.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            {[
              "Live score updates",
              "Umpire mode",
              "Spectator view",
              "Walkie-talkie",
              "Match stats",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 22px",
                  borderRadius: 999,
                  fontSize: 24,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
