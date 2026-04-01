"use client"

import type { ReactNode } from "react"
import type { Track, MusicObject, TransitionPlan, WaveformPeak, CuePoint, LoopRegion } from "@/lib/types"
import type { TransitionState } from "@/lib/music-engine"
import type { SongStructure } from "@/lib/song-structure"
import { Library, Sliders, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Deck } from "@/components/dj/deck"
import { Mixer } from "@/components/dj/mixer"
import { MusicLibrary } from "@/components/library/music-library"
import { GrokChatPanel } from "@/components/grok/grok-chat-panel"

export type DjPanelTab = "library" | "ai" | "dj"

const TABS: { id: DjPanelTab; label: string; icon: ReactNode }[] = [
  { id: "library", label: "Library", icon: <Library className="h-3.5 w-3.5" /> },
  { id: "ai", label: "AI", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "dj", label: "DJ", icon: <Sliders className="h-3.5 w-3.5" /> },
]

type AnalyserSnapshot = { frequency: Uint8Array; timeDomain: Uint8Array }

interface DjSidePanelProps {
  activeTab: DjPanelTab
  onSelectTab: (tab: DjPanelTab) => void
  onClose: () => void
  trackA: Track | null
  trackB: Track | null
  tracks: Track[]
  musicObject: MusicObject
  transitionState: TransitionState
  isPlayingA: boolean
  isPlayingB: boolean
  currentTimeA: number
  currentTimeB: number
  durationA: number
  durationB: number
  bpmA: number | null
  bpmB: number | null
  camelotA?: string | null
  camelotB?: string | null
  keyCompatibility?: number | null
  waveformPeaksA?: WaveformPeak[] | null
  waveformPeaksB?: WaveformPeak[] | null
  structureA?: SongStructure | null
  structureB?: SongStructure | null
  cuePointsA?: CuePoint[]
  cuePointsB?: CuePoint[]
  loopA?: LoopRegion | null
  loopB?: LoopRegion | null
  getAnalyserData: () => AnalyserSnapshot
  onLoadToDeck: (track: Track, deck: "A" | "B") => void
  onApplyPreset: (preset: Partial<MusicObject>) => void
  onApplyTransition: (plan: TransitionPlan) => void
  onVoiceAction: (action: string, params?: Record<string, unknown>) => void
  onCancelTransition: () => void
  play: (deck?: "A" | "B") => void
  pause: (deck?: "A" | "B") => void
  seek: (deck: "A" | "B", time: number) => void
  setCrossfade: (value: number) => void
  onIsolationChange: (deck: "A" | "B", type: "bass" | "voice" | "melody", value: number) => void
  updateMusicObject: (partial: Partial<MusicObject>) => void
  onAddCue?: (deck: "A" | "B", time: number) => void
  onJumpToCue?: (deck: "A" | "B", cueId: string) => void
  onSetBeatLoop?: (deck: "A" | "B", beats: number) => void
  onClearLoop?: (deck: "A" | "B") => void
  onVinylBrake?: (deck: "A" | "B") => void
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

export function DjSidePanel({
  activeTab, onSelectTab, onClose,
  trackA, trackB, tracks, musicObject, transitionState,
  isPlayingA, isPlayingB, currentTimeA, currentTimeB, durationA, durationB,
  bpmA, bpmB, camelotA, camelotB, keyCompatibility,
  waveformPeaksA, waveformPeaksB, structureA, structureB, cuePointsA, cuePointsB, loopA, loopB,
  getAnalyserData, onLoadToDeck, onApplyPreset, onApplyTransition,
  onVoiceAction, onCancelTransition, play, pause, seek, setCrossfade,
  onIsolationChange, updateMusicObject,
  onAddCue, onJumpToCue, onSetBeatLoop, onClearLoop, onVinylBrake,
  getAudioContext,
}: DjSidePanelProps) {
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col bg-[#08080f]",
        "max-xl:fixed max-xl:inset-0 max-xl:z-50 max-xl:w-full max-xl:pt-[env(safe-area-inset-top)]",
        "xl:relative xl:z-10 xl:h-full xl:w-72 xl:shrink-0 xl:border-r xl:border-white/[0.05] xl:pt-0 xl:shadow-none",
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-2 py-2.5 max-xl:justify-between xl:py-2">
        <div className="flex flex-1 items-center gap-1 max-xl:gap-2">
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              onClick={() => onSelectTab(id)}
              className={cn(
                "flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-medium transition-all xl:rounded-lg xl:py-2",
                activeTab === id
                  ? "bg-white/[0.1] text-white/85"
                  : "text-white/30 active:bg-white/[0.06] xl:hover:bg-white/[0.04] xl:hover:text-white/55",
              )}
            >
              <span className="xl:hidden">{icon}</span>
              <span className="hidden items-center gap-1.5 xl:inline-flex">
                {icon}
                {label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/60 xl:h-9 xl:w-9 xl:rounded-lg"
        >
          <X className="h-4 w-4 xl:h-3.5 xl:w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activeTab === "library" && (
          <div className="p-2">
            <MusicLibrary onLoadToDeck={onLoadToDeck} trackA={trackA} trackB={trackB} />
          </div>
        )}

        <div className={activeTab === "ai" ? "h-full" : "hidden"}>
          <GrokChatPanel
            trackA={trackA}
            trackB={trackB}
            musicObject={musicObject}
            tracks={tracks}
            transitionState={transitionState}
            isPlayingA={isPlayingA}
            isPlayingB={isPlayingB}
            structureA={structureA}
            structureB={structureB}
            getAnalyserData={getAnalyserData}
            onApplySettings={onApplyPreset}
            onApplyTransition={onApplyTransition}
            onApplyPreset={onApplyPreset}
            onAction={onVoiceAction}
            onLoadTrack={onLoadToDeck}
            onCancelTransition={onCancelTransition}
            currentTimeA={currentTimeA}
            currentTimeB={currentTimeB}
            durationA={durationA}
            durationB={durationB}
            getAudioContext={getAudioContext}
          />
        </div>

        {activeTab === "dj" && (
          <div className="flex flex-col gap-2 p-2">
            <Deck
              deck="A"
              track={trackA}
              isPlaying={isPlayingA}
              currentTime={currentTimeA}
              duration={durationA}
              onPlay={() => play("A")}
              onPause={() => pause("A")}
              onSeek={(time) => seek("A", time)}
              onGainChange={(gain) =>
                updateMusicObject({
                  tracks: { ...musicObject.tracks, A: musicObject.tracks.A ? { ...musicObject.tracks.A, gain } : null },
                })
              }
              onTempoChange={(playbackRate) =>
                updateMusicObject({
                  tracks: { ...musicObject.tracks, A: musicObject.tracks.A ? { ...musicObject.tracks.A, playbackRate } : null },
                })
              }
              gain={musicObject.tracks.A?.gain}
              playbackRate={musicObject.tracks.A?.playbackRate ?? 1}
              bpm={bpmA}
              detectedKey={null}
              camelotKey={camelotA}
              waveformPeaks={waveformPeaksA}
              cuePoints={cuePointsA}
              loop={loopA}
              onAddCue={onAddCue ? (time) => onAddCue("A", time) : undefined}
              onJumpToCue={onJumpToCue ? (id) => onJumpToCue("A", id) : undefined}
              onSetBeatLoop={onSetBeatLoop ? (beats) => onSetBeatLoop("A", beats) : undefined}
              onClearLoop={onClearLoop ? () => onClearLoop("A") : undefined}
              onVinylBrake={onVinylBrake ? () => onVinylBrake("A") : undefined}
            />
            <Mixer
              musicObject={musicObject}
              onCrossfadeChange={setCrossfade}
              onEQChange={(band, value) => updateMusicObject({ eq: { ...musicObject.eq, [band]: value } })}
              onFilterChange={(cutoff) => updateMusicObject({ filter: { ...musicObject.filter, cutoff } })}
              onReverbChange={(value) => updateMusicObject({ reverbAmount: value })}
              onDelayChange={(value) => updateMusicObject({ delayAmount: value })}
              onMasterGainChange={(value) => updateMusicObject({ masterGain: value })}
              onIsolationChange={onIsolationChange}
              onFXChange={(param, value) => updateMusicObject({ fx: { ...musicObject.fx, [param]: value } })}
              onPerDeckEQChange={(deck, band, value) => {
                const current = musicObject.perDeckEq ?? { A: { low: 0, mid: 0, high: 0 }, B: { low: 0, mid: 0, high: 0 } }
                updateMusicObject({
                  perDeckEq: { ...current, [deck]: { ...current[deck], [band]: value } },
                })
              }}
              bpmA={bpmA}
              bpmB={bpmB}
              camelotA={camelotA}
              camelotB={camelotB}
              keyCompatibility={keyCompatibility}
            />
            <Deck
              deck="B"
              track={trackB}
              isPlaying={isPlayingB}
              currentTime={currentTimeB}
              duration={durationB}
              onPlay={() => play("B")}
              onPause={() => pause("B")}
              onSeek={(time) => seek("B", time)}
              onGainChange={(gain) =>
                updateMusicObject({
                  tracks: { ...musicObject.tracks, B: musicObject.tracks.B ? { ...musicObject.tracks.B, gain } : null },
                })
              }
              onTempoChange={(playbackRate) =>
                updateMusicObject({
                  tracks: { ...musicObject.tracks, B: musicObject.tracks.B ? { ...musicObject.tracks.B, playbackRate } : null },
                })
              }
              gain={musicObject.tracks.B?.gain}
              playbackRate={musicObject.tracks.B?.playbackRate ?? 1}
              bpm={bpmB}
              detectedKey={null}
              camelotKey={camelotB}
              waveformPeaks={waveformPeaksB}
              cuePoints={cuePointsB}
              loop={loopB}
              onAddCue={onAddCue ? (time) => onAddCue("B", time) : undefined}
              onJumpToCue={onJumpToCue ? (id) => onJumpToCue("B", id) : undefined}
              onSetBeatLoop={onSetBeatLoop ? (beats) => onSetBeatLoop("B", beats) : undefined}
              onClearLoop={onClearLoop ? () => onClearLoop("B") : undefined}
              onVinylBrake={onVinylBrake ? () => onVinylBrake("B") : undefined}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
