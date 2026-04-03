import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1a0533 0%, #0d0221 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
        }}
      >
        {/* Vinyl record outer ring */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "4px solid #7b5fc1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Center dot */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#7b5fc1",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
