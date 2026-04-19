"use client"

import Link from "next/link"
import { HeroCanvas } from "@/components/landing/hero-canvas"

export default function VariantA() {
  return (
    <main className="relative min-h-dvh w-full bg-[#0d0221] text-slate-100 overflow-hidden">
      {/* Full-bleed animated canvas */}
      <div className="fixed inset-0 z-0">
        <HeroCanvas intensity="full" />
        {/* Perspective grid */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
            backgroundSize: "60px 40px",
            transform: "perspective(500px) rotateX(65deg)",
            transformOrigin: "bottom center",
            maskImage: "linear-gradient(to top, black 20%, transparent)",
            WebkitMaskImage: "linear-gradient(to top, black 20%, transparent)",
          }}
        />
        {/* Scan lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)",
          }}
        />
      </div>

      {/* Content layer */}
      <div className="relative z-10">
        <TopNav />
        <Hero />
        <Stats />
        <BackToShotgun />
      </div>
    </main>
  )
}

function TopNav() {
  return (
    <nav className="max-w-[1280px] mx-auto flex items-center px-8 py-5 gap-10">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-[14px] font-semibold tracking-tight font-mono">D4NCE</span>
      </Link>
      <div className="hidden md:flex gap-6 ml-2">
        {["Mix", "Library", "Vibes", "Docs"].map((l) => (
          <a key={l} href="#" className="text-[13px] font-medium text-slate-400 hover:text-slate-100 transition-colors">
            {l}
          </a>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[11px] text-emerald-300 font-mono">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ animation: "subtle-pulse 2.4s infinite" }}
          />
          Live · 12,438 tracks
        </div>
        <Link href="/" className="btn-primary text-[12.5px] px-3.5 py-1.5 rounded-md inline-flex items-center gap-1.5 font-medium">
          Open decks <span aria-hidden>→</span>
        </Link>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="max-w-[1100px] mx-auto px-8 pt-24 pb-16 text-center">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-[11.5px] text-slate-300 font-mono mb-8 backdrop-blur">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        v0.4 · Vibe-mix engine
      </div>

      <h1 className="text-[56px] lg:text-[80px] leading-[0.98] tracking-[-0.04em] font-semibold mb-6">
        AI that mixes
        <br />
        <span className="gradient-text">like a pro DJ.</span>
      </h1>

      <p className="text-[16px] lg:text-[17px] leading-[1.55] text-slate-300/85 max-w-[580px] mx-auto mb-10">
        Real-time beatmatching, key-aware transitions, and a copilot that knows when to drop the bass. Built for DJs who think in sets, not songs.
      </p>

      <div className="flex flex-wrap gap-3 items-center justify-center">
        <Link href="/" className="btn-primary text-[13.5px] px-5 py-2.5 rounded-md inline-flex items-center gap-2 font-medium">
          Open decks <span aria-hidden>→</span>
        </Link>
        <a href="#" className="btn-secondary text-[13.5px] px-5 py-2.5 rounded-md inline-flex items-center gap-2 backdrop-blur">
          <span aria-hidden>▸</span> Watch a 90-sec mix
        </a>
      </div>
    </section>
  )
}

function Stats() {
  const items = [
    ["12,438", "Tracks analyzed"],
    ["1.4s", "Avg transition"],
    ["99.2%", "Beat-match precision"],
    ["24 keys", "Camelot mapped"],
  ]
  return (
    <section className="max-w-[1100px] mx-auto px-8 pb-24">
      <div className="glass rounded-2xl p-7 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-2">
        {items.map(([n, l]) => (
          <div key={l} className="flex flex-col gap-1 lg:items-center">
            <div className="text-[28px] font-semibold tracking-[-0.025em] tabular-nums">{n}</div>
            <div className="text-[11.5px] text-slate-400 font-mono uppercase tracking-[0.14em]">{l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function LogoMark() {
  return (
    <div className="relative w-6 h-6 rounded-md bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center shadow-[0_0_18px_rgba(167,139,250,0.4)]">
      <div className="absolute inset-[1.5px] rounded-[4px] bg-gradient-to-br from-[#1a0a3a] to-[#0d0221]" />
      <span className="relative z-10 text-[10px] font-bold text-white font-mono">D</span>
    </div>
  )
}

function BackToShotgun() {
  return (
    <div className="fixed bottom-5 left-5 z-50">
      <Link
        href="/preview"
        className="text-[11px] font-mono text-violet-300/60 hover:text-violet-200 px-3 py-1.5 rounded-full border border-white/[0.08] bg-black/40 backdrop-blur transition-colors"
      >
        ← all variants
      </Link>
    </div>
  )
}
