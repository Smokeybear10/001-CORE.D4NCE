import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "D4NCE - AI-Powered DJ Mixing in the Browser"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0d0221 0%, #1a0533 30%, #2d1b4e 60%, #0d0221 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid lines */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40%",
            background:
              "linear-gradient(0deg, rgba(139,92,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.15) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            display: "flex",
          }}
        />
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(217,70,239,0.3) 0%, transparent 70%)",
            top: "20%",
            display: "flex",
          }}
        />
        {/* Title */}
        <div
          style={{
            fontSize: 140,
            fontWeight: 900,
            letterSpacing: "0.15em",
            background: "linear-gradient(90deg, #e879f9, #a855f7, #f472b6, #fb923c)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          D4NCE
        </div>
        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#c4b5fd",
            letterSpacing: "0.3em",
            marginTop: 16,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          AI-Powered DJ System
        </div>
        {/* Feature tags */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 40,
          }}
        >
          {["Dual Decks", "Voice Control", "3D Visualizer", "Beat Matching"].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  padding: "8px 20px",
                  borderRadius: 24,
                  border: "1px solid rgba(139,92,246,0.5)",
                  color: "#a78bfa",
                  fontSize: 18,
                  display: "flex",
                }}
              >
                {tag}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
