"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { Track, MusicObject, TransitionPlan } from "@/lib/types"
import { findBestEntryPoint } from "@/lib/song-structure"
import { useMusicEngine } from "@/hooks/use-music-engine"
import { useTracks } from "@/hooks/use-tracks"
import { ThreeVisualizer } from "@/components/visualizer/three-visualizer"
import { DjAppHeader } from "@/components/dj/dj-app-header"
import { DjSidePanel, type DjPanelTab } from "@/components/dj/dj-side-panel"
import { DjHelpModal } from "@/components/dj/dj-help-modal"
import { MobileVisualizerDock } from "@/components/dj/mobile-visualizer-dock"
import { ErrorBoundary } from "@/components/error-boundary"

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
    // Advanced features
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
  const [sidePanel, setSidePanel] = useState<DjPanelTab | null>(null)
  const lastPanelRef = useRef<DjPanelTab>("library")
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setSidePanel("library")
    }
  }, [])

  useEffect(() => {
    if (!sidePanel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidePanel(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sidePanel])
  const [showHelp, setShowHelp] = useState(false)
  const [bpmA, setBpmA] = useState<number | null>(null)
  const [bpmB, setBpmB] = useState<number | null>(null)

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

      // If this is the first track loaded, snap crossfader to this deck
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
    [isInitialized, initialize, loadTrack, musicEngine, musicObject.tracks, updateMusicObject],
  )

  const handleApplyTransition = useCallback(
    (plan: TransitionPlan) => {
      // Determine which deck is currently the "active" one
      // The AI always generates plans as outgoing→incoming (crossfader 0→1)
      // We need to figure out which physical deck is outgoing
      let outgoingDeck: "A" | "B" = "A"
      let incomingDeck: "A" | "B" = "B"

      if (isPlayingB && !isPlayingA) {
        outgoingDeck = "B"
        incomingDeck = "A"
      } else if (isPlayingA && isPlayingB) {
        // Both playing — the deck closer to full volume is outgoing
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

      const incomingTrack = incomingDeck === "A" ? trackA : trackB
      const incomingPlaying = incomingDeck === "A" ? isPlayingA : isPlayingB

      // Determine where to start the incoming track:
      // 1. Use AI's incomingStartSeconds if provided
      // 2. Fall back to structure analysis bestEntryPoint
      // 3. Default to 0 (start from beginning)
      const incomingStructure = incomingDeck === "A" ? structureA : structureB
      const structureEntry = incomingStructure ? findBestEntryPoint(incomingStructure).time : 0
      const cuePoint = (plan.incomingStartSeconds && plan.incomingStartSeconds > 0)
        ? plan.incomingStartSeconds
        : structureEntry
      if (cuePoint > 0) seek(incomingDeck, cuePoint)

      // Track the real crossfader position (React state may be stale in the setTimeout)
      let actualCrossfader = musicObject.crossfader

      // Before starting the incoming deck, snap the crossfader fully to the outgoing deck
      // so the incoming deck is silent when it starts
      if (!incomingPlaying && incomingTrack) {
        const safeStart = outgoingDeck === "A" ? 0 : 1
        setCrossfade(safeStart)
        updateMusicObject({ crossfader: safeStart })
        actualCrossfader = safeStart
        play(incomingDeck)
      }

      const startDelay = (plan.startDelay || 0) * 1000

      setTimeout(() => {
        const adjustedPlan = { ...plan }

        // When B is outgoing, the AI plan was generated as A→B (0→1)
        // We need to flip everything: crossfader values, and swap deck automations
        if (outgoingDeck === "B") {
          // Invert crossfader: 0→1 becomes 1→0
          adjustedPlan.crossfadeAutomation = plan.crossfadeAutomation.map(point => ({
            t: point.t, value: 1 - point.value,
          }))

          // Swap deck-specific automations (AI's "A" was outgoing = our B, AI's "B" was incoming = our A)
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

        // Resolve trigger deck references AFTER the direction swap
        if (adjustedPlan.triggers) {
          adjustedPlan.triggers = adjustedPlan.triggers.map(t => ({
            ...t,
            deck: t.deck === "outgoing" ? outgoingDeck
              : t.deck === "incoming" ? incomingDeck
              : t.deck,
          }))
        }

        // Use the actual crossfader position we set (not stale React state)
        // to prevent the safety check from jumping to 0.5
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
    [isInitialized, initialize, play, pause, musicObject.crossfader, setCrossfade],
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

  const toggleSidePanel = useCallback(() => {
    setSidePanel((p) => (p ? null : lastPanelRef.current))
  }, [])

  const selectSideTab = useCallback((tab: DjPanelTab) => {
    lastPanelRef.current = tab
    setSidePanel(tab)
  }, [])

  return (
    <ErrorBoundary>
    <div className="relative flex h-dvh min-h-0 w-screen max-w-[100vw] flex-col overflow-hidden bg-[#020207]">
      <DjAppHeader
        musicObject={musicObject}
        onModeChange={(mode) => updateMusicObject({ visualizerMode: mode })}
        onColorSchemeChange={(scheme) => updateMusicObject({ colorScheme: scheme })}
        sidePanelOpen={!!sidePanel}
        onToggleSidePanel={toggleSidePanel}
        onShowHelp={() => setShowHelp(true)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden lg:flex-row">
        {sidePanel && (
          <DjSidePanel
            activeTab={sidePanel}
            onSelectTab={selectSideTab}
            onClose={() => setSidePanel(null)}
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
            bpmA={bpmA}
            bpmB={bpmB}
            camelotA={keyA?.camelot ?? null}
            camelotB={keyB?.camelot ?? null}
            keyCompatibility={keyCompatibility}
            waveformPeaksA={waveformPeaksA}
            waveformPeaksB={waveformPeaksB}
            structureA={structureA}
            structureB={structureB}
            cuePointsA={cuePointsA}
            cuePointsB={cuePointsB}
            loopA={loopA}
            loopB={loopB}
            getAnalyserData={getAnalyserData}
            onLoadToDeck={handleLoadToDeck}
            onApplyPreset={handleApplyPreset}
            onApplyTransition={handleApplyTransition}
            onVoiceAction={handleVoiceAction}
            onCancelTransition={cancelTransition}
            play={play}
            pause={pause}
            seek={seek}
            setCrossfade={setCrossfade}
            onIsolationChange={handleIsolationChange}
            updateMusicObject={updateMusicObject}
            onAddCue={addCuePoint}
            onJumpToCue={jumpToCue}
            onSetBeatLoop={setBeatLoop}
            onClearLoop={clearLoop}
            onVinylBrake={vinylBrake}
            getAudioContext={getAudioContext}
          />
        )}

        <div className="relative min-h-0 flex-1">
          <ThreeVisualizer analyserData={analyserData} musicObject={musicObject} />
        </div>

        <MobileVisualizerDock
          visible={!sidePanel}
          musicObject={musicObject}
          onModeChange={(mode) => updateMusicObject({ visualizerMode: mode })}
          onColorSchemeChange={(scheme) => updateMusicObject({ colorScheme: scheme })}
        />
      </div>

      <DjHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
    </ErrorBoundary>
  )
}
