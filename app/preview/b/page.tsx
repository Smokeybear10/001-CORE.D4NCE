"use client"

import Link from "next/link"
import { HeroCanvas } from "@/components/landing/hero-canvas"
import { MiniDeck } from "../_components/mini-deck"
import { Disc3, Brain, KeyRound, Mic2, Zap } from "lucide-react"

export default function VariantB() {
  return (
    <main className="relative min-h-dvh w-full bg-[#0d0221] text-slate-100 overflow-hidden">
      {/* Ambient backdrop animation — dimmed */}
      <div className="absolute inset-0 z-0 opacity-50">
        <HeroCanvas intensity="ambient" />
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-[35%] z-0 opacity-[0.03]"
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

      <div className="relative z-10">
        <TopNav />
        <Hero />
        <Features />
        <ConsolePreview />
        <Footer />
        <BackToShotgun />
      </div>
    </main>
  )
}

function TopNav() {
  return (
    <nav className="max-w-[1400px] mx-auto flex items-center px-8 py-4 gap-10">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-[14px] font-semibold tracking-tight font-mono">D4NCE</span>
      </Link>
      <div className="hidden md:flex gap-6">
        {[
          { label: "Mix", href: "#" },
          { label: "Library", href: "#" },
          { label: "Vibes", href: "#" },
          { label: "Docs", href: "#" },
        ].map((item) => (
          <Link key={item.href + item.label} href={item.href} className="text-[13px] font-medium text-slate-400 hover:text-slate-100 transition-colors">
            {item.label}
          </Link>
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
          Launch <span aria-hidden>→</span>
        </Link>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="max-w-[1400px] mx-auto px-8 pt-20 pb-24 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-16 items-center">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-[11.5px] text-slate-400 font-mono mb-7">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          v0.4 · Vibe-mix engine
        </div>

        <h1 className="text-[44px] lg:text-[56px] leading-[1.02] tracking-[-0.035em] font-semibold mb-5">
          AI that mixes
          <br />
          <span className="gradient-text">like a pro DJ.</span>
        </h1>

        <p className="text-[15.5px] leading-[1.55] text-slate-400 max-w-[520px] mb-8">
          Real-time beatmatching, key-aware transitions, and a copilot that knows when to drop the bass. Built for DJs who think in sets, not songs.
        </p>

        <div className="flex flex-wrap gap-2.5 items-center mb-12">
          <Link href="/" className="btn-primary text-[13.5px] px-4 py-2.5 rounded-md inline-flex items-center gap-2 font-medium">
            Open decks <span aria-hidden>→</span>
          </Link>
          <a href="#preview" className="btn-secondary text-[13.5px] px-4 py-2.5 rounded-md inline-flex items-center gap-2 backdrop-blur">
            See AI mix
          </a>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-5 pt-7 border-t border-white/[0.06]">
          <Proof n="12,438" l="Tracks analyzed" />
          <Proof n="1.4s" l="Avg transition" />
          <Proof n="99.2%" l="Beat-match precision" />
          <Proof n="24" l="Camelot keys" />
        </div>
      </div>

      <MiniDeck />
    </section>
  )
}

function Proof({ n, l }: { n: string; l: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[22px] font-semibold tracking-[-0.025em] tabular-nums">{n}</div>
      <div className="text-[11.5px] text-slate-500 font-medium">{l}</div>
    </div>
  )
}

function Features() {
  const feats = [
    {
      color: "#a78bfa",
      title: "Realtime beat-match",
      body: "Phase-locked tempo sync across decks. Drift-free at 0.01 BPM.",
      icon: <Disc3 size={15} strokeWidth={1.8} />,
    },
    {
      color: "#22d3ee",
      title: "Key-aware blending",
      body: "Camelot-mapped key detection. Only harmonic transitions surface.",
      icon: <KeyRound size={15} strokeWidth={1.8} />,
    },
    {
      color: "#f472b6",
      title: "AI copilot",
      body: "Grok plans transitions, picks the next track, handles your FX.",
      icon: <Brain size={15} strokeWidth={1.8} />,
    },
    {
      color: "#fbbf24",
      title: "Voice control",
      body: "‘Smooth into the next one’ works. So does ‘kill the bass for 8 bars.’",
      icon: <Mic2 size={15} strokeWidth={1.8} />,
    },
  ]
  return (
    <section className="max-w-[1400px] mx-auto px-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
      {feats.map((f) => (
        <div key={f.title} className="glass rounded-xl p-5 hover:border-violet-400/25 transition-colors">
          <div
            className="w-9 h-9 rounded-lg mb-3.5 border border-white/[0.08] bg-white/[0.02] flex items-center justify-center"
            style={{ color: f.color }}
          >
            {f.icon}
          </div>
          <h4 className="text-[13.5px] font-semibold mb-1.5 text-slate-100">{f.title}</h4>
          <p className="text-[12.5px] text-slate-400 leading-[1.5]">{f.body}</p>
        </div>
      ))}
    </section>
  )
}

function ConsolePreview() {
  return (
    <section id="preview" className="max-w-[1400px] mx-auto px-8 pt-24 pb-24">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="text-[10.5px] font-mono tracking-[0.22em] text-slate-500 uppercase mb-2">The console</div>
          <h2 className="text-[30px] font-semibold tracking-[-0.02em] leading-[1.15]">Two decks. One copilot. Zero fumbling.</h2>
          <p className="text-[13.5px] text-slate-400 mt-2 max-w-[520px] leading-[1.5]">
            Waveforms, mixer, library, and AI suggestions in one workspace. Drag panels where you want them.
          </p>
        </div>
        <Link href="/" className="btn-primary text-[13px] px-4 py-2 rounded-md inline-flex items-center gap-2">
          Open console <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.015]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          </div>
          <div className="mx-auto font-mono text-[10.5px] text-slate-500 px-2.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05]">
            d4nce.app
          </div>
          <div className="w-16" />
        </div>

        {/* Mock workspace */}
        <div className="grid grid-cols-[200px_1fr_300px] h-[440px]">
          {/* Library */}
          <aside className="border-r border-white/[0.06] p-2 overflow-hidden">
            <div className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-slate-500 px-2 py-1.5">
              Library · 412
            </div>
            {[
              ["Phase Shift", "Mass", "128", true],
              ["Untitled — Vibe", "Anyma", "126"],
              ["Glass Tower", "Massano", "124"],
              ["Echoes", "Boris Brejcha", "127"],
              ["Polaroid", "Mind Against", "125"],
              ["Static Sleep", "Recondite", "122"],
              ["Voltage", "Rebūke", "130"],
            ].map(([t, a, b, sel]) => (
              <div
                key={String(t)}
                className={`flex justify-between items-center px-2.5 py-2 rounded-md text-[11.5px] ${
                  sel ? "bg-violet-500/10 text-slate-100 border border-violet-400/20" : "text-slate-300 hover:bg-white/[0.02] border border-transparent"
                }`}
              >
                <div className="truncate">
                  <div className="font-medium truncate">{t}</div>
                  <div className="text-[10px] text-slate-500 truncate">{a}</div>
                </div>
                <span className="font-mono text-[10px] text-violet-300/70 ml-2">{b}</span>
              </div>
            ))}
          </aside>

          {/* Center: deck workspace */}
          <div className="relative bg-[#0a0218] overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(139,92,246,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.025) 1px,transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />
            <div className="relative z-10 p-4 h-full flex flex-col gap-4">
              <DeckPanel label="A" track="Phase Shift — Mass" bpm="128" key1="8A" color="violet" playing />
              <DeckPanel label="B" track="Untitled — Vibe" bpm="128" key1="9A" color="amber" />
              <div className="mt-auto glass rounded-lg p-3 flex items-center gap-3">
                <Zap size={14} className="text-fuchsia-300/80 shrink-0" />
                <div className="flex-1 text-[11.5px] text-slate-300">
                  <span className="text-violet-200 font-medium">Smooth blend at bar 32.</span> Energy +14%, key compatible. Want me to take it?
                </div>
                <button className="text-[10.5px] font-mono uppercase tracking-[0.12em] px-2.5 py-1 rounded-md bg-violet-500/15 border border-violet-400/30 text-violet-200">
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Mixer + FX */}
          <aside className="border-l border-white/[0.06] overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-[12px] font-semibold text-slate-100">Mixer</h3>
              <span className="font-mono text-[10px] text-violet-300/70">live</span>
            </div>
            <div className="p-4 space-y-4">
              <EQRow label="EQ A" />
              <EQRow label="EQ B" />
              <div className="pt-2 border-t border-white/[0.05]">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500 mb-2">Crossfade</div>
                <div className="relative h-[6px] rounded-full bg-white/[0.05]">
                  <div className="absolute top-0 bottom-0 w-[2px] rounded-full bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.6)]" style={{ left: "62%" }} />
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.05]">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500 mb-2">FX</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {["Reverb 0.30", "Delay 0.55", "Filter 0.70", "Iso 0.40"].map((s) => (
                    <div key={s} className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function DeckPanel({ label, track, bpm, key1, color, playing }: {
  label: string; track: string; bpm: string; key1: string; color: "violet" | "amber"; playing?: boolean
}) {
  const colorClass = color === "violet" ? "text-violet-300" : "text-amber-300"
  const grad = color === "violet"
    ? "from-violet-400/80 to-fuchsia-400/70"
    : "from-amber-400/80 to-pink-400/70"
  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center justify-between mb-2 text-[11px]">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold ${colorClass}`}>{label}</span>
          <span className="text-slate-200 font-medium">{track}</span>
          {playing && (
            <span className="text-[9px] font-mono text-emerald-300 px-1.5 py-px rounded bg-emerald-400/10 border border-emerald-400/20">
              ▸ playing
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums text-slate-400">
          <span>{bpm} BPM</span>
          <span className="text-violet-300/70">{key1}</span>
        </div>
      </div>
      <div className="h-[60px] rounded-md bg-black/30 border border-white/[0.04] overflow-hidden relative">
        <div className={`absolute inset-0 bg-gradient-to-b ${grad} opacity-70`} style={{
          maskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 60' preserveAspectRatio='none'%3E%3Cpath d='M0 30 Q5 14 10 28 T20 22 T30 30 T40 18 T50 32 T60 24 T70 30 T80 16 T90 28 T100 22 T110 32 T120 26 T130 30 T140 14 T150 28 T160 22 T170 32 T180 24 T190 30 T200 18 T210 28 T220 22 T230 30 T240 16 T250 28 T260 24 T270 30 T280 14 T290 28 T300 20 T310 30 T320 18 T330 28 T340 22 T350 30 T360 16 T370 28 T380 22 T390 30 T400 24 T410 30 T420 14 T430 28 T440 22 T450 30 T460 18 T470 28 T480 24 T490 30 T500 16 T510 28 T520 22 T530 30 T540 24 T550 30 T560 18 T570 28 T580 22 T590 30 T600 24' fill='black' stroke='black' stroke-width='28' /%3E%3C/svg%3E\")",
          maskSize: "100% 100%",
          WebkitMaskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 60' preserveAspectRatio='none'%3E%3Cpath d='M0 30 Q5 14 10 28 T20 22 T30 30 T40 18 T50 32 T60 24 T70 30 T80 16 T90 28 T100 22 T110 32 T120 26 T130 30 T140 14 T150 28 T160 22 T170 32 T180 24 T190 30 T200 18 T210 28 T220 22 T230 30 T240 16 T250 28 T260 24 T270 30 T280 14 T290 28 T300 20 T310 30 T320 18 T330 28 T340 22 T350 30 T360 16 T370 28 T380 22 T390 30 T400 24 T410 30 T420 14 T430 28 T440 22 T450 30 T460 18 T470 28 T480 24 T490 30 T500 16 T510 28 T520 22 T530 30 T540 24 T550 30 T560 18 T570 28 T580 22 T590 30 T600 24' fill='black' stroke='black' stroke-width='28' /%3E%3C/svg%3E\")",
          WebkitMaskSize: "100% 100%",
        }} />
        <div className="absolute top-0 bottom-0 w-[1.5px] bg-white/85" style={{ left: "42%" }} />
      </div>
    </div>
  )
}

function EQRow({ label }: { label: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500 mb-1.5">{label}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {["LO", "MID", "HI"].map((b, i) => (
          <div key={b} className="flex flex-col items-center gap-1">
            <div className="relative w-full h-1 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-400/60 to-fuchsia-400/60"
                style={{ width: `${[60, 75, 50][i]}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-500">{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="max-w-[1400px] mx-auto px-8 py-8 border-t border-white/[0.06] flex flex-wrap justify-between gap-4 text-[12px] text-slate-500">
      <div>D4NCE · v0.4 · AI co-pilot for DJs</div>
      <div className="font-mono">© 2026 · Built by Thomas Ou</div>
    </footer>
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
