import type React from "react"
import type { Metadata, Viewport } from "next"
import { Orbitron, Rajdhani } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
})

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani",
})

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:2001"

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "D4NCE | AI-Powered DJ Mixing in the Browser",
    template: "%s | D4NCE",
  },
  description:
    "Browser-based DJ system with AI mixing. Dual decks, 3-band EQ, stem isolation, reverb, delay, and 3D audio visualization. Talk to the AI copilot by voice or text to automate transitions, beat match, and control effects.",
  keywords: [
    "DJ app",
    "AI DJ",
    "browser DJ",
    "web audio",
    "beat matching",
    "audio mixing",
    "music mixing",
    "DJ software",
    "AI music",
    "audio visualization",
    "3D visualizer",
    "stem isolation",
    "EQ mixing",
    "crossfader",
    "BPM detection",
    "voice controlled DJ",
    "online DJ",
    "D4NCE",
  ],
  authors: [{ name: "Thomas Ou" }],
  creator: "Thomas Ou",
  publisher: "Thomas Ou",
  applicationName: "D4NCE",
  category: "Music",
  classification: "Web Application",
  openGraph: {
    title: "D4NCE | AI-Powered DJ Mixing in the Browser",
    description:
      "Dual-deck DJ system with AI copilot. Voice and text commands for transitions, beat matching, EQ automation, stem isolation, and 3D audio visualization.",
    siteName: "D4NCE",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "D4NCE | AI-Powered DJ Mixing in the Browser",
    description:
      "Dual-deck DJ system with AI copilot. Voice and text commands for transitions, beat matching, EQ automation, stem isolation, and 3D audio visualization.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
}

export const viewport: Viewport = {
  themeColor: "#0d0221",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "D4NCE",
    description:
      "Browser-based DJ system with AI mixing. Dual decks, 3-band EQ, stem isolation, reverb, delay, and 3D audio visualization.",
    url: baseUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern browser with Web Audio API support",
    author: {
      "@type": "Person",
      name: "Thomas Ou",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Dual-deck audio playback",
      "AI-powered mixing with voice and text commands",
      "3-band EQ with per-deck control",
      "Stem isolation (bass, voice, melody)",
      "Reverb, delay, and flanger effects",
      "Real-time BPM detection and beat matching",
      "3D audio-reactive visualization",
      "Cue points and beat-synced loops",
      "Track library with cloud storage",
    ],
  }

  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.variable} ${rajdhani.variable} font-sans antialiased select-none`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg">
          Skip to content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
