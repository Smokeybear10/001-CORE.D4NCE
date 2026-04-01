"use client"

import { useMemo } from "react"
import type { Track, MusicObject, WaveformPeak, CuePoint, LoopRegion } from "@/lib/types"
import { Play, Pause } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransportBarProps {
  trackA: Track | null
  trackB: Track | null
  musicObject: MusicObject
  isPlayingA: boolean
  isPlayingB: boolean
  currentTimeA: number
  currentTimeB: number
  durationA: number
  durationB: number
  bpmA?: number | null
  bpmB?: number | null
  camelotKeyA?: string | null
  camelotKeyB?: string | null
  waveformPeaksA?: WaveformPeak[] | null
  waveformPeaksB?: WaveformPeak[] | null
  cuePointsA?: CuePoint[]
  cuePointsB?: CuePoint[]
  loopA?: LoopRegion | null
  loopB?: LoopRegion | null
  onPlay: (deck?: "A" | "B") => void
  onPause: (deck?: "A" | "B") => void
  onSeek: (deck: "A" | "B", time: number) => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

function InlineWaveform({
  deck, track, isPlaying, currentTime, duration,
  bpm, camelotKey, waveformPeaks, cuePoints, loop,
  onPlay, onPause, onSeek,
}: {
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
}) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isA = deck === "A"
  const remaining = duration > 0 ? duration - currentTime : 0

  const bars = waveformPeaks?.length || 200
  const barData = useMemo(() => {
    if (!waveformPeaks?.length) {
      return Array.from({ length: 200 }, (_, i) => ({
        h: 2 + ((((i * 47 + 13) % 29) * 7 + ((i * 73 + 7) % 19) * 3) / 29),
      }))
    }
    return waveformPeaks.map(p => ({
      h: Math.max(1, p.rms * 30 + Math.abs(p.max - p.min) * 10),
    }))
  }, [waveformPeaks])

  const loopStartPct = loop && duration > 0 ? (loop.startTime / duration) * 100 : null
  const loopEndPct = loop && duration > 0 ? (loop.endTime / duration) * 100 : null

  const playedColor = isA ? "rgba(246,46,151," : "rgba(1,205,254,"
  const unplayedColor = "rgba(185,103,255,"

  return (
    <div className={cn(
      "group relative flex-1 min-w-0 h-[48px] rounded-lg overflow-hidden transition-all cursor-pointer",
      "bg-[#150535]/70 border border-violet-500/[0.1]",
      isPlaying && (isA
        ? "border-fuchsia-500/20 shadow-[0_0_16px_rgba(246,46,151,0.15)]"
        : "border-cyan-500/20 shadow-[0_0_16px_rgba(1,205,254,0.15)]"
      ),
    )}>
      {/* Top info row */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-2 pt-0.5 pointer-events-none">
        <div className="flex items-center gap-1 min-w-0">
          <span className={cn(
            "shrink-0 text-[9px] font-mono font-bold",
            isA ? "text-fuchsia-400/65" : "text-cyan-400/65",
          )}>{deck}</span>
          {track && (
            <span className="text-[10px] text-amber-200/50 truncate">{track.title}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {bpm && <span className="text-[9px] font-mono text-amber-300/45 tabular-nums">{Math.round(bpm)}</span>}
          {camelotKey && <span className="text-[8px] font-mono text-violet-300/35">{camelotKey}</span>}
        </div>
      </div>

      {/* Empty state */}
      {!track && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-mono text-violet-300/25 tracking-wide">Load a track</span>
        </div>
      )}

      {/* Waveform SVG */}
      <div
        className="h-full w-full"
        onClick={(e) => {
          if (!duration) return
          const rect = e.currentTarget.getBoundingClientRect()
          onSeek(((e.clientX - rect.left) / rect.width) * duration)
        }}
      >
        <svg viewBox={`0 0 ${bars} 28`} className="w-full h-full" preserveAspectRatio="none">
          {loopStartPct !== null && loopEndPct !== null && loop?.active && (
            <rect
              x={(loopStartPct / 100) * bars} y={0}
              width={((loopEndPct - loopStartPct) / 100) * bars} height={28}
              fill="rgba(185,103,255,0.05)"
            />
          )}

          {barData.map((bar, i) => {
            const played = (i / bars) * 100 < progress
            const h = Math.min(12, bar.h)
            const color = played ? playedColor : unplayedColor
            const opacity = played ? 0.65 : 0.05
            return (
              <g key={i}>
                <rect x={i} y={14 - h} width={0.7} height={h} fill={`${color}${opacity})`} />
                <rect x={i} y={14} width={0.7} height={h * 0.3} fill={`${color}${opacity * 0.35})`} />
              </g>
            )
          })}

          {cuePoints?.map(cue => {
            const x = duration > 0 ? (cue.time / duration) * bars : 0
            return (
              <line key={cue.id} x1={x} y1={0} x2={x} y2={28}
                stroke={isA ? "rgba(246,46,151,0.35)" : "rgba(1,205,254,0.35)"} strokeWidth={0.4}
              />
            )
          })}

          {progress > 0 && (
            <rect
              x={Math.max(0, (progress / 100) * bars - 0.25)}
              y={0} width={0.4} height={28}
              fill="rgba(255,255,255,0.6)"
            />
          )}
        </svg>
      </div>

      {/* Time overlay */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-2 pb-0.5 pointer-events-none">
        <span className="text-[8px] font-mono text-violet-300/35 tabular-nums">{formatTime(currentTime)}</span>
        <span className="text-[8px] font-mono text-violet-300/35 tabular-nums">-{formatTime(remaining)}</span>
      </div>

      {/* Play/pause on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); isPlaying ? onPause() : onPlay() }}
        disabled={!track}
        className={cn(
          "absolute left-2 bottom-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full transition-all",
          "opacity-0 group-hover:opacity-100 pointer-events-auto",
          isA ? "text-fuchsia-400/60 hover:text-fuchsia-400" : "text-cyan-400/60 hover:text-cyan-400",
          !track && "hidden",
        )}
      >
        {isPlaying ? <Pause className="h-2 w-2" /> : <Play className="h-2 w-2 ml-px" />}
      </button>
    </div>
  )
}

export function TransportBar({
  trackA, trackB, musicObject,
  isPlayingA, isPlayingB,
  currentTimeA, currentTimeB,
  durationA, durationB,
  bpmA, bpmB,
  camelotKeyA, camelotKeyB,
  waveformPeaksA, waveformPeaksB,
  cuePointsA, cuePointsB,
  loopA, loopB,
  onPlay, onPause, onSeek,
}: TransportBarProps) {

  return (
    <div className="absolute top-[44px] inset-x-0 z-25">
      <div className="bg-[#110328]/90 backdrop-blur-md border-b border-violet-500/[0.08] shadow-[0_4px_30px_rgba(21,5,53,0.6)]">
        {/* Waveform strips */}
        <div className="flex gap-1.5 px-3 py-2 sm:px-4">
          <InlineWaveform
            deck="A" track={trackA} isPlaying={isPlayingA}
            currentTime={currentTimeA} duration={durationA}
            bpm={bpmA} camelotKey={camelotKeyA}
            waveformPeaks={waveformPeaksA} cuePoints={cuePointsA} loop={loopA}
            onPlay={() => onPlay("A")} onPause={() => onPause("A")}
            onSeek={(t) => onSeek("A", t)}
          />
          <InlineWaveform
            deck="B" track={trackB} isPlaying={isPlayingB}
            currentTime={currentTimeB} duration={durationB}
            bpm={bpmB} camelotKey={camelotKeyB}
            waveformPeaks={waveformPeaksB} cuePoints={cuePointsB} loop={loopB}
            onPlay={() => onPlay("B")} onPause={() => onPause("B")}
            onSeek={(t) => onSeek("B", t)}
          />
        </div>
      </div>
    </div>
  )
}
