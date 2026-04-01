"use client"

import type { Track, MusicObject, TransitionPlan } from "@/lib/types"
import type { SongStructure } from "@/lib/song-structure"
import { X, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { GrokChatPanel } from "@/components/grok/grok-chat-panel"

type AnalyserSnapshot = { frequency: Uint8Array; timeDomain: Uint8Array }

interface AIPanelProps {
  open: boolean
  onClose: () => void
  trackA: Track | null
  trackB: Track | null
  tracks: Track[]
  musicObject: MusicObject
  transitionState: unknown
  isPlayingA: boolean
  isPlayingB: boolean
  currentTimeA: number
  currentTimeB: number
  durationA: number
  durationB: number
  structureA?: SongStructure | null
  structureB?: SongStructure | null
  getAnalyserData: () => AnalyserSnapshot
  onApplySettings: (settings: Partial<MusicObject>) => void
  onApplyPreset: (preset: Partial<MusicObject>) => void
  onApplyTransition: (plan: TransitionPlan) => void
  onAction: (action: string, params?: Record<string, unknown>) => void
  onLoadTrack: (track: Track, deck: "A" | "B") => void
  onCancelTransition: () => void
  getAudioContext?: () => {
    summary: string
    energyPhase: string
    averageEnergy: number
    energyTrend: number
    camelotA: string | null
    camelotB: string | null
    [key: string]: unknown
  }
}

export function AIPanel({
  open, onClose,
  trackA, trackB, tracks, musicObject, transitionState,
  isPlayingA, isPlayingB, currentTimeA, currentTimeB, durationA, durationB,
  structureA, structureB,
  getAnalyserData, onApplySettings, onApplyPreset, onApplyTransition,
  onAction, onLoadTrack, onCancelTransition, getAudioContext,
}: AIPanelProps) {
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0d0221]/40 sm:hidden"
        onClick={onClose}
      />

      <div className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-2xl",
        "bg-[#150535]/95 backdrop-blur-lg border border-violet-500/[0.15] shadow-[0_0_40px_rgba(185,103,255,0.1)]",
        "inset-x-3 bottom-[70px] top-[60px] sm:inset-auto",
        "sm:bottom-[80px] sm:right-4 sm:w-[360px] sm:h-[480px]",
      )}>
        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none scanlines opacity-30" />

        <div className="relative flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-fuchsia-400/40" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-fuchsia-400/30">AI</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center text-violet-300/15 hover:text-violet-300/35 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="relative flex-1 min-h-0">
          <GrokChatPanel
            trackA={trackA}
            trackB={trackB}
            tracks={tracks}
            musicObject={musicObject}
            transitionState={transitionState}
            isPlayingA={isPlayingA}
            isPlayingB={isPlayingB}
            currentTimeA={currentTimeA}
            currentTimeB={currentTimeB}
            durationA={durationA}
            durationB={durationB}
            structureA={structureA}
            structureB={structureB}
            getAnalyserData={getAnalyserData}
            onApplySettings={onApplySettings}
            onApplyPreset={onApplyPreset}
            onApplyTransition={onApplyTransition}
            onAction={onAction}
            onLoadTrack={onLoadTrack}
            onCancelTransition={onCancelTransition}
            getAudioContext={getAudioContext}
          />
        </div>
      </div>
    </>
  )
}
