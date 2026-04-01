"use client"

import { useState, useCallback, useEffect } from "react"
import type { Track, MusicObject, TransitionPlan } from "@/lib/types"
import { findBestEntryPoint } from "@/lib/song-structure"
import { useMusicEngine } from "@/hooks/use-music-engine"
import { useTracks } from "@/hooks/use-tracks"
import { ThreeVisualizer } from "@/components/visualizer/three-visualizer"
import { TopBar } from "@/components/top-bar"
import { TransportBar } from "@/components/transport-bar"
import { MixerPanel } from "@/components/mixer-panel"
import { LibraryDrawer } from "@/components/library-drawer"
import { AIPanel } from "@/components/ai-panel"
import { DraggableCard } from "@/components/draggable-card"
import { DjHelpModal } from "@/components/dj/dj-help-modal"
import { ErrorBoundary } from "@/components/error-boundary"
import { SlidersHorizontal, Library, Sparkles } from "lucide-react"

export default function DJSystem() {
  const { tracks } = useTracks()
  const {
    isInitialized,
    initialize,
    loadTrack,
    play,
    pause,
    seek,
    setCrossfade,
    updateMusicObject,
    applyTransitionPlan,
    cancelTransition,
    isPlayingA,
    isPlayingB,
    currentTimeA,
    currentTimeB,
    durationA,
    durationB,
    musicObject,
    analyserData,
    getAnalyserData,
    transitionState,
    musicEngine,
    keyA,
    keyB,
    keyCompatibility,
    waveformPeaksA,
    waveformPeaksB,
    structureA,
    structureB,
    cuePointsA,
    cuePointsB,
    loopA,
    loopB,
    addCuePoint,
    jumpToCue,
    setBeatLoop,
    clearLoop,
    vinylBrake,
    getAudioContext,
  } = useMusicEngine()

  const [trackA, setTrackA] = useState<Track | null>(null)
  const [trackB, setTrackB] = useState<Track | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [mixerOpen, setMixerOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [bpmA, setBpmA] = useState<number | null>(null)
  const [bpmB, setBpmB] = useState<number | null>(null)

  // Escape closes panels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (aiOpen) setAiOpen(false)
        else if (libraryOpen) setLibraryOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [aiOpen, libraryOpen])

  const handleLoadToDeck = useCallback(
    async (track: Track, deck: "A" | "B") => {
      if (!isInitialized) await initialize()

      await loadTrack(deck, track.url)

      const trackSettings = {
        id: track.id,
        url: track.url,
        title: track.title,
        artist: track.artist,
        gain: 1,
        pan: 0,
        playbackRate: 1,
        enabled: true,
      }

      const otherDeck = deck === "A" ? "B" : "A"
      const hasOtherTrack = musicObject.tracks[otherDeck] !== null
      const xfade = !hasOtherTrack ? (deck === "A" ? 0 : 1) : undefined

      updateMusicObject({
        tracks: { ...musicObject.tracks, [deck]: trackSettings },
        ...(xfade !== undefined ? { crossfader: xfade } : {}),
      })
      if (xfade !== undefined) setCrossfade(xfade)

      if (deck === "A") setTrackA(track)
      else setTrackB(track)

      // Poll for BPM
      const setBpm = deck === "A" ? setBpmA : setBpmB
      let attempts = 0
      const interval = setInterval(() => {
        const bpm = musicEngine?.getBPM(deck) ?? null
        if (bpm !== null || attempts >= 20) {
          setBpm(bpm)
          clearInterval(interval)
        }
        attempts++
      }, 250)
    },
    [isInitialized, initialize, loadTrack, musicEngine, musicObject.tracks, updateMusicObject, setCrossfade],
  )

  const handleApplyTransition = useCallback(
    (plan: TransitionPlan) => {
      let outgoingDeck: "A" | "B" = "A"
      let incomingDeck: "A" | "B" = "B"

      if (isPlayingB && !isPlayingA) {
        outgoingDeck = "B"
        incomingDeck = "A"
      } else if (isPlayingA && isPlayingB) {
        outgoingDeck = musicObject.crossfader <= 0.5 ? "A" : "B"
        incomingDeck = outgoingDeck === "A" ? "B" : "A"
      } else if (!isPlayingA && !isPlayingB) {
        if (trackA) {
          play("A")
          outgoingDeck = "A"
          incomingDeck = "B"
        } else if (trackB) {
          play("B")
          outgoingDeck = "B"
          incomingDeck = "A"
        }
      }

      const incomingPlaying = incomingDeck === "A" ? isPlayingA : isPlayingB
      const incomingStructure = incomingDeck === "A" ? structureA : structureB
      const structureEntry = incomingStructure ? findBestEntryPoint(incomingStructure).time : 0
      const cuePoint = (plan.incomingStartSeconds && plan.incomingStartSeconds > 0)
        ? plan.incomingStartSeconds
        : structureEntry
      if (cuePoint > 0) seek(incomingDeck, cuePoint)

      let actualCrossfader = musicObject.crossfader

      if (!incomingPlaying && (incomingDeck === "A" ? trackA : trackB)) {
        const safeStart = outgoingDeck === "A" ? 0 : 1
        setCrossfade(safeStart)
        updateMusicObject({ crossfader: safeStart })
        actualCrossfader = safeStart
        play(incomingDeck)
      }

      const startDelay = (plan.startDelay || 0) * 1000

      setTimeout(() => {
        const adjustedPlan = { ...plan }

        if (outgoingDeck === "B") {
          adjustedPlan.crossfadeAutomation = plan.crossfadeAutomation.map(point => ({
            t: point.t, value: 1 - point.value,
          }))
          const origAEq = plan.deckAEqAutomation
          const origBEq = plan.deckBEqAutomation
          adjustedPlan.deckAEqAutomation = origBEq
          adjustedPlan.deckBEqAutomation = origAEq
          const origATempo = plan.deckATempoAutomation
          const origBTempo = plan.deckBTempoAutomation
          adjustedPlan.deckATempoAutomation = origBTempo
          adjustedPlan.deckBTempoAutomation = origATempo
          const origAIso = plan.deckAIsolationAutomation
          const origBIso = plan.deckBIsolationAutomation
          adjustedPlan.deckAIsolationAutomation = origBIso
          adjustedPlan.deckBIsolationAutomation = origAIso
        }

        if (adjustedPlan.triggers) {
          adjustedPlan.triggers = adjustedPlan.triggers.map(t => ({
            ...t,
            deck: t.deck === "outgoing" ? outgoingDeck
              : t.deck === "incoming" ? incomingDeck
              : t.deck,
          }))
        }

        if (adjustedPlan.crossfadeAutomation.length > 0) {
          const expectedStart = adjustedPlan.crossfadeAutomation[0]?.value ?? 0
          if (Math.abs(actualCrossfader - expectedStart) > 0.05) {
            adjustedPlan.crossfadeAutomation = [
              { t: 0, value: actualCrossfader },
              ...adjustedPlan.crossfadeAutomation.filter(p => p.t > 0.05),
            ]
          }
        }

        applyTransitionPlan(adjustedPlan)

        if (plan.visualizerConfig) {
          updateMusicObject(plan.visualizerConfig)
        }
      }, Math.max(startDelay, incomingPlaying ? 0 : 150))
    },
    [applyTransitionPlan, updateMusicObject, isPlayingA, isPlayingB, trackA, trackB, structureA, structureB, play, seek, setCrossfade, musicObject.crossfader],
  )

  const handleApplyPreset = useCallback(
    (preset: Partial<MusicObject>) => {
      const merged: Partial<MusicObject> = {
        ...preset,
        eq: preset.eq ? { ...musicObject.eq, ...preset.eq } : musicObject.eq,
        filter: preset.filter ? { ...musicObject.filter, ...preset.filter } : musicObject.filter,
        tracks: preset.tracks
          ? {
              A: preset.tracks.A ? { ...musicObject.tracks.A, ...preset.tracks.A } : musicObject.tracks.A,
              B: preset.tracks.B ? { ...musicObject.tracks.B, ...preset.tracks.B } : musicObject.tracks.B,
            }
          : musicObject.tracks,
      }
      updateMusicObject(merged)
    },
    [updateMusicObject, musicObject],
  )

  const handleVoiceAction = useCallback(
    async (action: string, params?: Record<string, unknown>) => {
      switch (action) {
        case "play":
          if (!isInitialized) await initialize()
          if (params?.deck === "both") play()
          else play(params?.deck as "A" | "B" | undefined)
          break
        case "pause":
          if (params?.deck === "both") pause()
          else pause(params?.deck as "A" | "B" | undefined)
          break
        case "transition":
          if (params?.type === "smooth") {
            const targetDeck = musicObject.crossfader < 0.5 ? "B" : "A"
            const targetIsPlaying = targetDeck === "A" ? isPlayingA : isPlayingB
            const targetTrack = targetDeck === "A" ? trackA : trackB
            if (!targetIsPlaying && targetTrack) play(targetDeck)
            setTimeout(() => {
              const start = musicObject.crossfader
              const end = start < 0.5 ? 1 : 0
              let progress = 0
              const interval = setInterval(() => {
                progress += 0.01
                if (progress >= 1) {
                  clearInterval(interval)
                  setCrossfade(end)
                } else {
                  setCrossfade(start + (end - start) * progress)
                }
              }, 50)
            }, targetIsPlaying ? 0 : 100)
          }
          break
        case "analyze":
          break
      }
    },
    [isInitialized, initialize, play, pause, musicObject.crossfader, setCrossfade, isPlayingA, isPlayingB, trackA, trackB],
  )

  const handleIsolationChange = useCallback(
    (deck: "A" | "B", type: "bass" | "voice" | "melody", value: number) => {
      const trackSettings = musicObject.tracks[deck]
      if (!trackSettings) return
      const isolationKey = `${type}Isolation` as "bassIsolation" | "voiceIsolation" | "melodyIsolation"
      updateMusicObject({
        tracks: {
          ...musicObject.tracks,
          [deck]: { ...trackSettings, [isolationKey]: value },
        },
      })
    },
    [musicObject.tracks, updateMusicObject],
  )

  const handlePerDeckEQChange = useCallback(
    (deck: "A" | "B", band: "low" | "mid" | "high", value: number) => {
      const currentA = musicObject.perDeckEq?.A ?? { low: 0, mid: 0, high: 0 }
      const currentB = musicObject.perDeckEq?.B ?? { low: 0, mid: 0, high: 0 }
      updateMusicObject({
        perDeckEq: {
          A: deck === "A" ? { ...currentA, [band]: value } : currentA,
          B: deck === "B" ? { ...currentB, [band]: value } : currentB,
        },
      })
    },
    [musicObject.perDeckEq, updateMusicObject],
  )

  const handleFXChange = useCallback(
    (param: string, value: number) => {
      updateMusicObject({ fx: { ...musicObject.fx, [param]: value } })
    },
    [musicObject.fx, updateMusicObject],
  )

  // Quick transition trigger from transport bar
  const handleQuickTransition = useCallback(() => {
    // Open AI panel and let AI generate the transition
    setAiOpen(true)
  }, [])

  return (
    <ErrorBoundary>
      <div className="relative h-dvh w-screen max-w-[100vw] overflow-hidden bg-[#0d0221]">
        {/* Fullscreen visualizer background */}
        <div className="absolute inset-0 z-0">
          <ThreeVisualizer analyserData={analyserData} musicObject={musicObject} />
        </div>


        {/* Top bar */}
        <TopBar
          musicObject={musicObject}
          onModeChange={(mode) => updateMusicObject({ visualizerMode: mode })}
          onColorSchemeChange={(scheme) => updateMusicObject({ colorScheme: scheme })}
          aiOpen={aiOpen}
          onToggleAI={() => setAiOpen(!aiOpen)}
          libraryOpen={libraryOpen}
          onToggleLibrary={() => setLibraryOpen(!libraryOpen)}
          mixerOpen={mixerOpen}
          onToggleMixer={() => setMixerOpen(!mixerOpen)}
          onShowHelp={() => setShowHelp(true)}
        />

        {/* Waveform strip — always visible at top */}
        <TransportBar
          trackA={trackA}
          trackB={trackB}
          musicObject={musicObject}
          isPlayingA={isPlayingA}
          isPlayingB={isPlayingB}
          currentTimeA={currentTimeA}
          currentTimeB={currentTimeB}
          durationA={durationA}
          durationB={durationB}
          bpmA={bpmA}
          bpmB={bpmB}
          camelotKeyA={keyA?.camelot}
          camelotKeyB={keyB?.camelot}
          waveformPeaksA={waveformPeaksA}
          waveformPeaksB={waveformPeaksB}
          cuePointsA={cuePointsA}
          cuePointsB={cuePointsB}
          loopA={loopA}
          loopB={loopB}
          onPlay={(deck) => { if (!isInitialized) { initialize().then(() => play(deck)) } else play(deck) }}
          onPause={pause}
          onSeek={seek}
        />

        {/* Floating draggable cards */}
        {mixerOpen && (
          <DraggableCard
            id="mixer"
            title="Mix"
            icon={<SlidersHorizontal className="h-2.5 w-2.5 text-violet-300/30" />}
            defaultPosition={{ x: 8, y: 120 }}
            defaultSize={{ width: 200, height: 480 }}
            onClose={() => setMixerOpen(false)}
          >
            <MixerPanel
              musicObject={musicObject}
              transitionState={transitionState}
              bpmA={bpmA}
              bpmB={bpmB}
              camelotA={keyA?.camelot ?? null}
              camelotB={keyB?.camelot ?? null}
              keyCompatibility={keyCompatibility}
              onCrossfadeChange={(v) => { setCrossfade(v); updateMusicObject({ crossfader: v }) }}
              onEQChange={(band, value) => updateMusicObject({ eq: { ...musicObject.eq, [band]: value } })}
              onFilterChange={(cutoff) => updateMusicObject({ filter: { ...musicObject.filter, cutoff } })}
              onReverbChange={(v) => updateMusicObject({ reverbAmount: v })}
              onDelayChange={(v) => updateMusicObject({ delayAmount: v })}
              onMasterGainChange={(v) => updateMusicObject({ masterGain: v })}
              onIsolationChange={handleIsolationChange}
              onFXChange={handleFXChange}
              onPerDeckEQChange={handlePerDeckEQChange}
              onTransition={handleQuickTransition}
              onCancelTransition={cancelTransition}
              trackALoaded={!!trackA}
              trackBLoaded={!!trackB}
            />
          </DraggableCard>
        )}

        {libraryOpen && (
          <DraggableCard
            id="library"
            title="Library"
            icon={<Library className="h-2.5 w-2.5 text-violet-300/30" />}
            defaultPosition={{ x: typeof window !== "undefined" ? window.innerWidth - 260 : 1020, y: 120 }}
            defaultSize={{ width: 240, height: 440 }}
            onClose={() => setLibraryOpen(false)}
            accentColor="cyan"
          >
            <LibraryDrawer
              onLoadToDeck={handleLoadToDeck}
              trackA={trackA}
              trackB={trackB}
            />
          </DraggableCard>
        )}

        {aiOpen && (
          <DraggableCard
            id="ai-copilot"
            title="AI"
            icon={<Sparkles className="h-2.5 w-2.5 text-fuchsia-400/30" />}
            defaultPosition={{ x: 8, y: typeof window !== "undefined" ? window.innerHeight - 340 : 380 }}
            defaultSize={{ width: 340, height: 320 }}
            onClose={() => setAiOpen(false)}
            accentColor="fuchsia"
          >
            <AIPanel
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
              onApplySettings={(settings) => updateMusicObject(settings)}
              onApplyPreset={handleApplyPreset}
              onApplyTransition={handleApplyTransition}
              onAction={handleVoiceAction}
              onLoadTrack={handleLoadToDeck}
              onCancelTransition={cancelTransition}
              getAudioContext={getAudioContext}
            />
          </DraggableCard>
        )}

        <DjHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    </ErrorBoundary>
  )
}
