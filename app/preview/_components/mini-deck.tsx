"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, SlidersHorizontal } from "lucide-react"

export function MiniDeck() {
  return (
    <div className="relative w-full min-h-[440px]">
      {/* Decks card */}
      <div className="absolute top-0 right-0 w-[420px] max-w-full glass rounded-xl p-3.5 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3 w-3 text-violet-300/60" />
            <span className="text-[11.5px] font-semibold text-slate-200">Live Decks</span>
          </div>
          <span className="font-mono text-[10px] text-violet-300/60 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            128 BPM · 4/4
          </span>
        </div>
        <DeckRow label="A" track="Untitled — Vibe" bpm="128" key1="8A" color="violet" />
        <DeckRow label="B" track="Phase Shift — Mass" bpm="128" key1="9A" color="amber" />
        <Crossfader />
      </div>

      {/* AI Copilot bubble */}
      <div className="absolute top-[280px] -left-2 sm:-left-4 lg:-left-6 w-[300px] max-w-[88vw] glass rounded-xl p-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3 w-3 text-fuchsia-300/70" />
          <span className="text-[11.5px] font-semibold text-slate-200">AI Copilot</span>
          <span className="ml-auto text-[9.5px] text-violet-300/50 font-mono uppercase tracking-[0.1em]">grok</span>
        </div>
        <p className="text-[12px] text-slate-300 leading-[1.5] mb-3">
          Smooth blend at <span className="text-violet-200">bar 32</span>. Energy <span className="text-emerald-300">+14%</span>, key compatible.
        </p>
        <div className="flex items-center gap-2">
          <button className="text-[10.5px] font-mono uppercase tracking-[0.12em] px-2.5 py-1 rounded-md bg-violet-500/15 border border-violet-400/25 text-violet-200 hover:bg-violet-500/25 transition-colors">
            Apply transition
          </button>
          <button className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-slate-400 hover:text-slate-200 transition-colors">
            Skip
          </button>
        </div>
      </div>

      {/* FX card */}
      <div className="absolute top-[200px] right-0 w-[210px] glass rounded-xl p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-semibold text-slate-200">FX</span>
          <span className="font-mono text-[9.5px] text-slate-500">live</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { name: "rev", v: 0.3, c: "violet" },
            { name: "dly", v: 0.55, c: "fuchsia" },
            { name: "flt", v: 0.7, c: "amber" },
            { name: "iso", v: 0.4, c: "cyan" },
          ].map((k) => (
            <Knob key={k.name} {...k} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DeckRow({ label, track, bpm, key1, color }: { label: string; track: string; bpm: string; key1: string; color: "violet" | "amber" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offsetRef = useRef(label === "A" ? 0 : 80)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
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
      offsetRef.current += 0.5
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      if (color === "violet") {
        grad.addColorStop(0, "rgba(167,139,250,0.85)")
        grad.addColorStop(1, "rgba(232,121,249,0.7)")
      } else {
        grad.addColorStop(0, "rgba(251,146,60,0.85)")
        grad.addColorStop(1, "rgba(244,114,182,0.7)")
      }
      ctx.fillStyle = grad
      const barCount = 80
      const barW = w / barCount
      for (let i = 0; i < barCount; i++) {
        const x = i + offsetRef.current * 0.3
        const v = Math.abs(Math.sin(x * 0.18) * 0.5 + Math.sin(x * 0.07) * 0.4 + Math.sin(x * 0.32) * 0.2)
        const ah = Math.max(2, v * h * 0.85)
        ctx.fillRect(i * barW, (h - ah) / 2, barW - 0.5, ah)
      }
      // Playhead
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.fillRect(w * 0.42, 0, 1, h)

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [color])

  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-bold ${color === "violet" ? "text-violet-300" : "text-amber-300"}`}>
            {label}
          </span>
          <span className="text-slate-300 truncate max-w-[180px]">{track}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-slate-400 tabular-nums">
          <span>{bpm} BPM</span>
          <span className="text-violet-300/70">{key1}</span>
        </div>
      </div>
      <div className="h-[34px] rounded-md bg-black/30 overflow-hidden border border-white/[0.04]">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  )
}

function Crossfader() {
  const [pos, setPos] = useState(0.5)
  useEffect(() => {
    let raf = 0
    let t = 0
    const tick = () => {
      t += 0.012
      setPos(0.5 + Math.sin(t) * 0.32)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[9px] font-mono text-violet-300/60 uppercase tracking-[0.14em]">A</span>
      <div className="relative flex-1 h-[6px] rounded-full bg-white/[0.05] border border-white/[0.04]">
        <div
          className="absolute top-0 bottom-0 w-[2px] rounded-full bg-gradient-to-b from-violet-300 to-fuchsia-300 shadow-[0_0_10px_rgba(167,139,250,0.6)] transition-[left] duration-100"
          style={{ left: `calc(${pos * 100}% - 1px)` }}
        />
      </div>
      <span className="text-[9px] font-mono text-amber-300/70 uppercase tracking-[0.14em]">B</span>
    </div>
  )
}

function Knob({ name, v, c }: { name: string; v: number; c: string }) {
  const colorMap: Record<string, string> = {
    violet: "text-violet-300 border-violet-400/30",
    fuchsia: "text-fuchsia-300 border-fuchsia-400/30",
    amber: "text-amber-300 border-amber-400/30",
    cyan: "text-cyan-300 border-cyan-400/30",
  }
  const angle = -120 + v * 240
  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-9 h-9 rounded-full border ${colorMap[c]} bg-black/30`}>
        <div
          className={`absolute top-1/2 left-1/2 w-[2px] h-3 -translate-x-1/2 origin-bottom rounded-full ${colorMap[c].split(" ")[0]} bg-current opacity-90`}
          style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)`, transformOrigin: "50% 100%" }}
        />
      </div>
      <span className="mt-1 text-[9px] font-mono uppercase tracking-[0.1em] text-slate-500">{name}</span>
    </div>
  )
}
