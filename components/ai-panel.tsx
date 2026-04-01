"use client"

import type { Track, MusicObject, TransitionPlan } from "@/lib/types"
import type { SongStructure } from "@/lib/song-structure"
import { GrokChatPanel } from "@/components/grok/grok-chat-panel"

type AnalyserSnapshot = { frequency: Uint8Array; timeDomain: Uint8Array }

interface AIPanelProps {
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
  trackA, trackB, tracks, musicObject, transitionState,
  isPlayingA, isPlayingB, currentTimeA, currentTimeB, durationA, durationB,
  structureA, structureB,
  getAnalyserData, onApplySettings, onApplyPreset, onApplyTransition,
  onAction, onLoadTrack, onCancelTransition, getAudioContext,
}: AIPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
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
  )
}
