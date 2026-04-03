import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "D4NCE - AI-Powered DJ System",
    short_name: "D4NCE",
    description:
      "Browser-based DJ system with AI mixing. Dual decks, EQ, stem isolation, effects, and 3D visualization.",
    start_url: "/?skipIntro",
    display: "standalone",
    background_color: "#0d0221",
    theme_color: "#0d0221",
    categories: ["music", "entertainment"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  }
}
