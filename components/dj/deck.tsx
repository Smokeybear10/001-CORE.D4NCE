"use client"

import { useState, useMemo } from "react"
import type { Track, WaveformPeak, CuePoint, LoopRegion } from "@/lib/types"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, Volume2, Music, Repeat, Flag, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface DeckProps {
  deck: "A" | "B"
  track: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onGainChange: (gain: number) => void
  onTempoChange: (rate: number) => void
  onAddCue?: (time: number) => void
  onJumpToCue?: (cueId: string) => void
  onSetBeatLoop?: (beats: number) => void
  onToggleLoop?: () => void
  onClearLoop?: () => void
  onVinylBrake?: () => void
  gain?: number
  playbackRate?: number
  bpm?: number | null
  detectedKey?: string | null
  camelotKey?: string | null
  waveformPeaks?: WaveformPeak[] | null
  cuePoints?: CuePoint[]
  loop?: LoopRegion | null
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

function formatRemaining(current: number, total: number) {
  if (total <= 0) return "-0:00"
  const remaining = Math.max(0, total - current)
  return `-${formatTime(remaining)}`
}

// Real audio waveform display with frequency coloring
function AudioWaveform({
  deck, progress, peaks, cuePoints, loop, duration, onSeek,
}: {
  deck: "A" | "B"
  progress: number
  peaks: WaveformPeak[] | null
  cuePoints?: CuePoint[]
  loop?: LoopRegion | null
  duration: number
  onSeek: (time: number) => void
}) {
  const isA = deck === "A"
  const accentHue = isA ? 265 : 185 // orange vs sky

  const bars = peaks?.length || 200
  const barData = useMemo(() => {
    if (!peaks?.length) {
      // Fallback static waveform
      return Array.from({ length: 200 }, (_, i) => ({
        h: 4 + Math.abs(Math.sin(i * 0.29) * 13 + Math.sin(i * 0.91) * 7 + Math.cos(i * 1.61) * 5),
        bass: 0.3, mid: 0.3, high: 0.3,
      }))
    }
    return peaks.map(p => ({
      h: Math.max(2, p.rms * 60 + Math.abs(p.max - p.min) * 20),
      bass: p.bassEnergy,
      mid: p.midEnergy,
      high: p.highEnergy,
    }))
  }, [peaks])

  const loopStartPct = loop && duration > 0 ? (loop.startTime / duration) * 100 : null
  const loopEndPct = loop && duration > 0 ? (loop.endTime / duration) * 100 : null

  return (
    <div
      className="relative h-16 rounded-lg overflow-hidden cursor-pointer group"
      style={{ background: "rgba(255,255,255,0.015)" }}
      onClick={(e) => {
        if (!duration) return
        const rect = e.currentTarget.getBoundingClientRect()
        onSeek(((e.clientX - rect.left) / rect.width) * duration)
      }}
    >
      <svg viewBox={`0 0 ${bars} 50`} className="w-full h-full" preserveAspectRatio="none">
        {/* Loop region highlight */}
        {loopStartPct !== null && loopEndPct !== null && loop?.active && (
          <rect
            x={(loopStartPct / 100) * bars}
            y={0}
            width={((loopEndPct - loopStartPct) / 100) * bars}
            height={50}
            fill={isA ? "rgba(246,46,151,0.08)" : "rgba(1,205,254,0.08)"}
          />
        )}

        {/* Center line */}
        <line x1={0} y1={25} x2={bars} y2={25} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />

        {/* Waveform bars */}
        {barData.map((bar, i) => {
          const played = (i / bars) * 100 < progress
          const h = Math.min(24, bar.h)

          // Frequency coloring: bass=blue/orange, mid=green, high=yellow/sky
          let r = 120, g = 120, b = 200
          if (bar.bass > bar.mid && bar.bass > bar.high) {
            r = isA ? 232 : 163; g = isA ? 121 : 230; b = isA ? 249 : 53
          } else if (bar.mid > bar.high) {
            r = 74; g = 222; b = 128
          } else {
            r = 250; g = 204; b = 21
          }

          const opacity = played ? 0.85 : 0.15
          const fill = `rgba(${r},${g},${b},${opacity})`

          return (
            <g key={i}>
              <rect x={i} y={25 - h} width={0.8} height={h} fill={fill} />
              <rect x={i} y={25} width={0.8} height={h * 0.4} fill={fill} opacity={0.4} />
            </g>
          )
        })}

        {/* Cue point markers */}
        {cuePoints?.map(cue => {
          const x = duration > 0 ? (cue.time / duration) * bars : 0
          return (
            <g key={cue.id}>
              <line x1={x} y1={0} x2={x} y2={50} stroke={cue.color} strokeWidth={0.8} opacity={0.8} />
              <polygon points={`${x},0 ${x + 2.5},0 ${x},4`} fill={cue.color} />
            </g>
          )
        })}

        {/* Loop boundaries */}
        {loopStartPct !== null && loopEndPct !== null && (
          <>
            <line x1={(loopStartPct / 100) * bars} y1={0} x2={(loopStartPct / 100) * bars} y2={50}
              stroke={isA ? "#f62e97" : "#01cdfe"} strokeWidth={1} strokeDasharray="2,2" />
            <line x1={(loopEndPct / 100) * bars} y1={0} x2={(loopEndPct / 100) * bars} y2={50}
              stroke={isA ? "#f62e97" : "#01cdfe"} strokeWidth={1} strokeDasharray="2,2" />
          </>
        )}

        {/* Playhead */}
        {progress > 0 && (
          <rect
            x={Math.max(0, (progress / 100) * bars - 0.4)}
            y={0} width={0.8} height={50}
            fill="white" opacity={0.9}
          />
        )}
      </svg>

      {/* Time overlay */}
      <div className="absolute bottom-0.5 left-1.5 right-1.5 flex justify-between pointer-events-none">
        <span className="text-[9px] font-mono text-white/25 tabular-nums">{formatTime(duration > 0 ? (progress / 100) * duration : 0)}</span>
        <span className="text-[9px] font-mono text-white/25 tabular-nums">{formatRemaining((progress / 100) * duration, duration)}</span>
      </div>
    </div>
  )
}

export function Deck({
  deck, track, isPlaying, currentTime, duration,
  onPlay, onPause, onSeek, onGainChange, onTempoChange,
  onAddCue, onJumpToCue, onSetBeatLoop, onToggleLoop, onClearLoop, onVinylBrake,
  gain = 1, playbackRate = 1, bpm, detectedKey, camelotKey,
  waveformPeaks, cuePoints, loop,
}: DeckProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isA = deck === "A"
  const accentColor = isA ? "text-fuchsia-400" : "text-cyan-400"
  const adjustedBPM = bpm ? Math.round(bpm * playbackRate) : null
  const [showCueMenu, setShowCueMenu] = useState(false)

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden border transition-all duration-300",
        isPlaying
          ? isA
            ? "border-fuchsia-500/20 shadow-[0_0_24px_rgba(246,46,151,0.12)]"
            : "border-cyan-500/20 shadow-[0_0_24px_rgba(1,205,254,0.12)]"
          : "border-violet-500/[0.08]"
      )}
    >
      {/* Top accent bar */}
      <div
        className={cn(
          "h-[1.5px] w-full transition-opacity duration-300",
          isA
            ? "bg-gradient-to-r from-fuchsia-500/0 via-pink-500 to-fuchsia-500/0"
            : "bg-gradient-to-r from-cyan-400/0 via-cyan-400 to-cyan-400/0",
          isPlaying ? "opacity-80" : "opacity-20"
        )}
      />

      <div className="bg-[#150535] p-3 flex flex-col gap-2.5">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest",
                isA ? "bg-fuchsia-500/15 text-fuchsia-400" : "bg-cyan-500/15 text-cyan-400"
              )}
            >
              {deck}
            </span>
            {isPlaying && (
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  isA ? "bg-fuchsia-400" : "bg-cyan-400"
                )}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {adjustedBPM && (
              <span className="text-[12px] font-mono font-semibold text-white/60 tabular-nums">{adjustedBPM} BPM</span>
            )}
            {camelotKey && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold",
                isA ? "bg-fuchsia-500/10 text-fuchsia-400/70" : "bg-cyan-500/10 text-cyan-400/70"
              )}>
                {camelotKey}
              </span>
            )}
            {detectedKey && !camelotKey && (
              <span className="text-[10px] text-white/25">{detectedKey}</span>
            )}
          </div>
        </div>

        {/* Track info */}
        {track ? (
          <div>
            <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">{track.title}</p>
            <p className="text-[11px] text-white/35 truncate mt-0.5">{track.artist}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-3 gap-1.5">
            <Music className="h-5 w-5 text-white/20" />
            <p className="text-[11px] text-white/20">No track loaded</p>
          </div>
        )}

        {/* Waveform */}
        <AudioWaveform
          deck={deck}
          progress={progress}
          peaks={waveformPeaks ?? null}
          cuePoints={cuePoints}
          loop={loop}
          duration={duration}
          onSeek={onSeek}
        />

        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSeek(0)}
            disabled={!track}
            title="Reset"
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-20 border",
              isA
                ? "text-fuchsia-400/60 hover:text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/10"
                : "text-cyan-400/60 hover:text-cyan-300 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/10"
            )}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!track}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20 shrink-0 border",
              isA
                ? "bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-400 border-fuchsia-500/30"
                : "bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border-cyan-500/30"
            )}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>

          {/* Volume */}
          <div className="flex-1 flex items-center gap-1.5">
            <Volume2 className="h-3 w-3 text-white/20 shrink-0" />
            <Slider value={[gain * 100]} onValueChange={([v]) => onGainChange(v / 100)} max={100} step={1} className="flex-1" />
          </div>

          {/* Cue button */}
          {onAddCue && track && (
            <button
              onClick={() => onAddCue(currentTime)}
              title="Set cue point"
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-all border",
                isA
                  ? "text-fuchsia-400/60 hover:text-fuchsia-300 border-fuchsia-500/20 hover:bg-fuchsia-500/10"
                  : "text-cyan-400/60 hover:text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/10"
              )}
            >
              <Flag className="h-3 w-3" />
            </button>
          )}

          {/* Vinyl brake */}
          {onVinylBrake && track && isPlaying && (
            <button
              onClick={onVinylBrake}
              title="Vinyl brake"
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-all border",
                isA
                  ? "text-fuchsia-400/60 hover:text-fuchsia-300 border-fuchsia-500/20 hover:bg-fuchsia-500/10"
                  : "text-cyan-400/60 hover:text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/10"
              )}
            >
              <Zap className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Cue points row */}
        {cuePoints && cuePoints.length > 0 && onJumpToCue && (
          <div className="flex gap-1 flex-wrap">
            {cuePoints.map((cue, i) => (
              <button
                key={cue.id}
                onClick={() => onJumpToCue(cue.id)}
                className="px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors hover:brightness-125"
                style={{ backgroundColor: `${cue.color}20`, color: cue.color }}
              >
                {cue.label}
              </button>
            ))}
          </div>
        )}

        {/* Beat loop buttons */}
        {track && onSetBeatLoop && (
          <div className="flex items-center gap-1.5">
            <Repeat className={cn("h-3 w-3 shrink-0", loop?.active ? accentColor : "text-white/20")} />
            {[1, 2, 4, 8, 16].map(beats => (
              <button
                key={beats}
                onClick={() => onSetBeatLoop(beats)}
                className={cn(
                  "flex-1 py-1 rounded text-[9px] font-mono font-bold transition-all border",
                  loop?.active
                    ? isA
                      ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-400"
                      : "border-cyan-500/30 bg-cyan-500/15 text-cyan-400"
                    : "border-violet-500/[0.08] text-white/30 hover:text-white/50 hover:border-white/10"
                )}
              >
                {beats}
              </button>
            ))}
            {loop && onClearLoop && (
              <button
                onClick={onClearLoop}
                className="px-2 py-1 rounded text-[9px] font-mono text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/30 transition-all"
              >
                X
              </button>
            )}
          </div>
        )}

        {/* Tempo */}
        {track && (
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] text-white/20 uppercase tracking-[0.15em] shrink-0 w-10">Tempo</span>
            <Slider value={[playbackRate * 100]} onValueChange={([v]) => onTempoChange(v / 100)} min={50} max={150} step={0.5} className="flex-1" />
            <span className={cn("text-[9px] font-mono tabular-nums w-10 text-right shrink-0", playbackRate !== 1 ? accentColor : "text-white/20")}>
              {playbackRate > 1 ? "+" : ""}{((playbackRate - 1) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
