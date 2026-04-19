"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { HeroCanvas } from "@/components/landing/hero-canvas"

export default function VariantC() {
  const [bgOpacity, setBgOpacity] = useState(1)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const vh = window.innerHeight
      // Full opacity at top, fully faded by 1.1 viewports down
      const raw = 1 - y / (vh * 0.45)
      const fade = Math.max(0, Math.min(1, raw)) ** 1.6
      setBgOpacity(fade)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])
  return (
    <main className="relative min-h-dvh w-full bg-[#0d0221] text-slate-100 overflow-hidden">
      {/* Full-bleed animated canvas (from variant A) — fades on scroll */}
      <div
        className="fixed inset-0 z-0 transition-opacity duration-100 ease-out"
        style={{ opacity: bgOpacity }}
      >
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
        {/* Soft vignette under hero text for readability */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 35% at 50% 30%, rgba(13,2,33,0.55), transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10">
        <TopNav />
        <Hero />
        <TransitionStrip />
        <FeaturePills />
        <Footer />
        <BackToShotgun />
      </div>
    </main>
  )
}

function TopNav() {
  return (
    <nav className="max-w-[1100px] mx-auto flex items-center px-8 py-5 gap-10">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="relative w-5 h-5 rounded bg-gradient-to-br from-violet-400 to-fuchsia-400 shadow-[0_0_14px_rgba(167,139,250,0.4)]">
          <div className="absolute inset-[1.5px] rounded-[3px] bg-[#0d0221]" />
        </div>
        <span className="text-[13px] font-medium tracking-tight font-mono lowercase">d4nce</span>
      </Link>
      <div className="ml-auto flex items-center gap-6">
        {["docs", "changelog"].map((l) => (
          <a key={l} href="#" className="text-[12px] font-mono text-slate-500 hover:text-slate-200 transition-colors">
            {l}
          </a>
        ))}
        <Link href="/" className="text-[12px] font-mono text-violet-300/80 hover:text-violet-200 transition-colors">
          launch →
        </Link>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="max-w-[720px] mx-auto px-8 pt-32 pb-16 text-center">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.01] text-[10.5px] text-slate-500 font-mono mb-12">
        <span
          className="w-1 h-1 rounded-full bg-cyan-400/80"
          style={{ animation: "subtle-pulse 2.4s infinite" }}
        />
        v0.4 · live beta
      </div>

      <h1
        className="text-[88px] sm:text-[116px] font-bold uppercase tracking-[0.12em] leading-[0.95] mb-10 text-transparent bg-clip-text font-mono"
        style={{
          backgroundImage: "linear-gradient(135deg, #f5f3ff 0%, #e879f9 50%, #a78bfa 100%)",
          textShadow: "0 0 80px rgba(167,139,250,0.25)",
          animation: "breath 6s ease infinite",
        }}
      >
        D4NCE
      </h1>

      <p className="text-[18px] sm:text-[20px] leading-[1.45] text-slate-300 font-light mb-2">
        AI that mixes like a pro DJ.
      </p>
      <p className="text-[18px] sm:text-[20px] leading-[1.45] text-slate-500 font-light mb-12">
        Beat by beat. Key by key.
      </p>

      <div className="flex items-center gap-5 justify-center">
        <Link href="/" className="btn-primary text-[13.5px] px-5 py-2.5 rounded-md inline-flex items-center gap-2 font-medium">
          Launch the mix <span aria-hidden>→</span>
        </Link>
        <a
          href="#"
          className="text-[13px] text-slate-400 hover:text-slate-100 transition-colors font-mono inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
        >
          watch demo · 90s
        </a>
      </div>
    </section>
  )
}

function TransitionStrip() {
  return (
    <section className="max-w-[1100px] mx-auto px-8 pb-16">
      <div className="flex items-center justify-between mb-3 text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">
        <span>Live transition · A → B</span>
        <span>16 bars · 32 beats</span>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          <div className="p-5 border-b lg:border-b-0 lg:border-r border-white/[0.05] space-y-3">
            <ScrollingWaveform color="violet" label="A · Phase Shift" bpm="128" key1="8A" />
            <ScrollingWaveform color="amber" label="B · Untitled — Vibe" bpm="128" key1="9A" reverse />
            <CrossfadeAutomation />
          </div>
          <AITerminal />
        </div>
      </div>
    </section>
  )
}

function ScrollingWaveform({ color, label, bpm, key1, reverse }: {
  color: "violet" | "amber"; label: string; bpm: string; key1: string; reverse?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0
    let offset = reverse ? 240 : 0
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()

    const draw = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)
      offset += reverse ? -0.4 : 0.4
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      if (color === "violet") {
        grad.addColorStop(0, "rgba(196,181,253,0.85)")
        grad.addColorStop(1, "rgba(232,121,249,0.65)")
      } else {
        grad.addColorStop(0, "rgba(252,176,64,0.85)")
        grad.addColorStop(1, "rgba(244,114,182,0.65)")
      }
      ctx.fillStyle = grad
      const barCount = 140
      const barW = w / barCount
      for (let i = 0; i < barCount; i++) {
        const x = i + offset * 0.5
        const v = Math.abs(Math.sin(x * 0.18) * 0.5 + Math.sin(x * 0.07) * 0.4 + Math.sin(x * 0.32) * 0.2)
        const ah = Math.max(2, v * h * 0.85)
        ctx.fillRect(i * barW, (h - ah) / 2, barW - 0.5, ah)
      }
      // Playhead
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.fillRect(w * (color === "violet" ? 0.62 : 0.38), 0, 1, h)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [color, reverse])

  const colorClass = color === "violet" ? "text-violet-300" : "text-amber-300"
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px] mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-semibold ${colorClass}`}>{label}</span>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-slate-500 tabular-nums">
          <span>{bpm} BPM</span>
          <span className="text-violet-300/70">{key1}</span>
        </div>
      </div>
      <div className="h-[42px] rounded-md bg-black/35 overflow-hidden border border-white/[0.04]">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  )
}

function CrossfadeAutomation() {
  return (
    <div className="pt-1">
      <div className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-1.5">Crossfade automation</div>
      <svg viewBox="0 0 600 30" className="w-full h-[26px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="xfade" x1="0" x2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <path
          d="M 0 24 C 100 24, 200 24, 300 15 C 400 6, 500 6, 600 6"
          stroke="url(#xfade)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    </div>
  )
}

function AITerminal() {
  const lines = [
    "▸ analyzing energy curve…",
    "▸ key match: 8A → 9A · compatible",
    "▸ entry point: bar 32, beat 1",
    "▸ blend duration: 16 bars",
    "▸ apply transition? [enter]",
  ]
  const [shown, setShown] = useState<string[]>([])
  useEffect(() => {
    setShown([])
    const timers: ReturnType<typeof setTimeout>[] = []
    lines.forEach((line, i) => {
      timers.push(setTimeout(() => setShown((p) => [...p, line]), 400 + i * 700))
    })
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <div className="p-5 space-y-1.5 font-mono text-[12px] bg-black/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/90" />
        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">copilot</span>
      </div>
      {shown.map((l, i) => {
        const isAction = l.includes("[enter]")
        return (
          <div
            key={i}
            className={`leading-[1.5] ${isAction ? "text-cyan-300" : "text-slate-300/80"} animate-[fadeIn_300ms_ease-out]`}
          >
            {l}
          </div>
        )
      })}
      <div className="h-3 w-1.5 bg-violet-300/80 inline-block animate-pulse mt-1" />
    </div>
  )
}

function FeaturePills() {
  const items = [
    "● realtime beat-match",
    "● key-aware blending",
    "● vibe presets",
    "● voice copilot",
  ]
  return (
    <section className="max-w-[1100px] mx-auto px-8 pb-24">
      <div className="flex flex-wrap gap-3 justify-center">
        {items.map((s) => (
          <span
            key={s}
            className="text-[11.5px] font-mono text-slate-400 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.01]"
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="max-w-[1100px] mx-auto px-8 py-10 border-t border-white/[0.04] flex flex-wrap justify-between gap-4 text-[11px] text-slate-500 font-mono">
      <div>d4nce · v0.4</div>
      <div>© 2026 · built by thomas ou</div>
    </footer>
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
