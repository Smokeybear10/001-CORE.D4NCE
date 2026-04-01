"use client"

import { useMemo } from "react"
import type { Track, WaveformPeak, CuePoint, LoopRegion } from "@/lib/types"
import { Play, Pause } from "lucide-react"
import { cn } from "@/lib/utils"

interface WaveformStripProps {
  deck: "A" | "B"
  track: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  bpm?: number | null
  camelotKey?: string | null
  waveformPeaks?: WaveformPeak[] | null
  cuePoints?: CuePoint[]
  loop?: LoopRegion | null
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

export function WaveformStrip({
  deck, track, isPlaying, currentTime, duration,
  bpm, camelotKey, waveformPeaks, cuePoints, loop,
  onPlay, onPause, onSeek,
}: WaveformStripProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isA = deck === "A"
  const remaining = duration > 0 ? duration - currentTime : 0

  const bars = waveformPeaks?.length || 300
  const barData = useMemo(() => {
    if (!waveformPeaks?.length) {
      return Array.from({ length: 300 }, (_, i) => ({
        h: 3 + ((((i * 47 + 13) % 29) * 10 + ((i * 73 + 7) % 19) * 5) / 29),
      }))
    }
    return waveformPeaks.map(p => ({
      h: Math.max(1.5, p.rms * 45 + Math.abs(p.max - p.min) * 15),
    }))
  }, [waveformPeaks])

  const loopStartPct = loop && duration > 0 ? (loop.startTime / duration) * 100 : null
  const loopEndPct = loop && duration > 0 ? (loop.endTime / duration) * 100 : null

  // Deck colors — amber for A, cyan for B
  const playedColor = isA ? "rgba(251,191,36," : "rgba(1,205,254,"
  const unplayedColor = "rgba(185,103,255,"

  return (
    <div
      className={cn(
        "group relative flex-1 min-w-0 h-[56px] sm:h-[64px] rounded-xl overflow-hidden transition-all",
        "bg-[#150535]/80 backdrop-blur-sm border border-violet-500/[0.1]",
        isPlaying && (isA
          ? "shadow-[0_0_24px_rgba(251,191,36,0.15)] border-amber-500/20"
          : "shadow-[0_0_24px_rgba(1,205,254,0.15)] border-cyan-500/20"
        ),
      )}
    >
      {/* Track info */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-1.5 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn(
            "shrink-0 text-[9px] font-mono font-bold",
            isA ? "text-amber-400/60 neon-pink" : "text-cyan-400/60 neon-cyan",
          )}>
            {deck}
          </span>
          {track && (
            <span className="text-[10px] text-amber-200/40 truncate">{track.title}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {bpm && <span className="text-[9px] font-mono text-amber-300/35 tabular-nums">{Math.round(bpm)}</span>}
          {camelotKey && <span className="text-[8px] font-mono text-violet-300/20">{camelotKey}</span>}
        </div>
      </div>

      {/* Waveform */}
      <div
        className="h-full w-full cursor-pointer"
        onClick={(e) => {
          if (!duration) return
          const rect = e.currentTarget.getBoundingClientRect()
          onSeek(((e.clientX - rect.left) / rect.width) * duration)
        }}
      >
        <svg viewBox={`0 0 ${bars} 40`} className="w-full h-full" preserveAspectRatio="none">
          {loopStartPct !== null && loopEndPct !== null && loop?.active && (
            <rect
              x={(loopStartPct / 100) * bars} y={0}
              width={((loopEndPct - loopStartPct) / 100) * bars} height={40}
              fill="rgba(185,103,255,0.05)"
            />
          )}

          {barData.map((bar, i) => {
            const played = (i / bars) * 100 < progress
            const h = Math.min(18, bar.h)
            const color = played ? playedColor : unplayedColor
            const opacity = played ? 0.7 : 0.06
            return (
              <g key={i}>
                <rect x={i} y={20 - h} width={0.7} height={h} fill={`${color}${opacity})`} />
                <rect x={i} y={20} width={0.7} height={h * 0.35} fill={`${color}${opacity * 0.4})`} />
              </g>
            )
          })}

          {cuePoints?.map(cue => {
            const x = duration > 0 ? (cue.time / duration) * bars : 0
            return (
              <g key={cue.id}>
                <line x1={x} y1={0} x2={x} y2={40} stroke={isA ? "rgba(251,191,36,0.4)" : "rgba(1,205,254,0.4)"} strokeWidth={0.5} />
              </g>
            )
          })}

          {progress > 0 && (
            <rect
              x={Math.max(0, (progress / 100) * bars - 0.3)}
              y={0} width={0.5} height={40}
              fill="rgba(255,255,255,0.7)"
            />
          )}
        </svg>
      </div>

      {/* Time */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-3 pb-1 pointer-events-none">
        <span className="text-[8px] font-mono text-violet-300/20 tabular-nums">{formatTime(currentTime)}</span>
        <span className="text-[8px] font-mono text-violet-300/20 tabular-nums">-{formatTime(remaining)}</span>
      </div>

      {/* Play hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); isPlaying ? onPause() : onPlay() }}
        disabled={!track}
        className={cn(
          "absolute left-3 bottom-1 z-10 flex h-5 w-5 items-center justify-center rounded-full transition-all",
          "opacity-0 group-hover:opacity-100 pointer-events-auto",
          isA ? "text-amber-400/60 hover:text-amber-400" : "text-cyan-400/60 hover:text-cyan-400",
          !track && "hidden",
        )}
      >
        {isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 ml-0.5" />}
      </button>
    </div>
  )
}
