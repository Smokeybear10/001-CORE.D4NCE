"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import type { Track, MusicObject, TransitionPlan } from "@/lib/types"
import { findBestEntryPoint, findNextExitPoint } from "@/lib/song-structure"
import { getTrackMeta, getNextBlendZone } from "@/lib/track-metadata"
import { useMusicEngine } from "@/hooks/use-music-engine"
import { useTracks } from "@/hooks/use-tracks"
import { ThreeVisualizer } from "@/components/visualizer/three-visualizer"
import { TopBar } from "@/components/top-bar"
import { TransportBar } from "@/components/transport-bar"
import { DraggableCard } from "@/components/draggable-card"
import { ErrorBoundary } from "@/components/error-boundary"
import { SlidersHorizontal, Library, Sparkles } from "lucide-react"

const MixerPanel = dynamic(() => import("@/components/mixer-panel").then(m => m.MixerPanel), { ssr: false })
const LibraryDrawer = dynamic(() => import("@/components/library-drawer").then(m => m.LibraryDrawer), { ssr: false })
const AIPanel = dynamic(() => import("@/components/ai-panel").then(m => m.AIPanel), { ssr: false })
const DjHelpModal = dynamic(() => import("@/components/dj/dj-help-modal").then(m => m.DjHelpModal), { ssr: false })

function LandingPage({ onEnter, skipIntro }: { onEnter: () => void; skipIntro?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (skipIntro) {
      setPhase(4)
      return
    }
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 1000),
      setTimeout(() => setPhase(4), 1500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [skipIntro])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // DPR 1 — this is ambient glow, doesn't need retina
    let w = 0, h = 0
    let glowGrad: CanvasGradient | null = null
    let lineGrad: CanvasGradient | null = null

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
      const cx = w * 0.5, cy = h * 0.45
      glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5)
      glowGrad.addColorStop(0, "rgba(139,92,246,0.08)")
      glowGrad.addColorStop(0.4, "rgba(246,46,151,0.03)")
      glowGrad.addColorStop(1, "transparent")
      lineGrad = ctx.createLinearGradient(0, 0, w, 0)
      lineGrad.addColorStop(0, "rgba(246,46,151,0.2)")
      lineGrad.addColorStop(0.5, "rgba(139,92,246,0.35)")
      lineGrad.addColorStop(1, "rgba(246,46,151,0.2)")
    }
    resize()
    window.addEventListener("resize", resize)

    // Particle pool — 20 max, single color
    const MAX_P = 20
    const px = new Float32Array(MAX_P)
    const py = new Float32Array(MAX_P)
    const pvx = new Float32Array(MAX_P)
    const pvy = new Float32Array(MAX_P)
    const plife = new Float32Array(MAX_P)
    const pmaxLife = new Float32Array(MAX_P)
    let pCount = 0

    let raf = 0
    const draw = (time: number) => {
      const t = time * 0.001
      const cx = w * 0.5, cy = h * 0.45

      ctx.clearRect(0, 0, w, h)

      // Single background glow
      if (glowGrad) {
        ctx.globalAlpha = 0.55 + Math.sin(t * 0.5) * 0.15
        ctx.fillStyle = glowGrad
        ctx.fillRect(0, 0, w, h)
        ctx.globalAlpha = 1
      }

      // Waveform bars — 24 bars, single fillStyle
      const barCount = 24
      const barW = w / barCount
      ctx.fillStyle = "rgba(160,100,240,0.06)"
      for (let i = 0; i < barCount; i++) {
        const freq = Math.sin(t * 1.2 + i * 0.28) * 0.5 + Math.sin(t * 0.7 + i * 0.15) * 0.3
        if (freq <= 0) continue
        const amplitude = freq * h * 0.08
        ctx.fillRect(i * barW, cy - amplitude, barW - 1, amplitude * 2)
      }

      // Waveform line — step 8px
      if (lineGrad) {
        ctx.beginPath()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = lineGrad
        for (let i = 0; i <= w; i += 8) {
          const p = i / w
          const env = 1 - (Math.abs(p - 0.5) * 2) ** 2
          const y = cy + (Math.sin(t * 1.5 + p * 14) * h * 0.03 + Math.sin(t * 0.9 + p * 7) * h * 0.02) * env
          i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y)
        }
        ctx.stroke()
      }

      // Particles — 20 max, single color, spawn from center area
      if (pCount < MAX_P && Math.random() < 0.1) {
        const i = pCount++
        px[i] = cx + (Math.random() - 0.5) * w * 0.4
        py[i] = cy + (Math.random() - 0.5) * h * 0.3
        pvx[i] = (Math.random() - 0.5) * 0.3
        pvy[i] = -(0.2 + Math.random() * 0.4)
        plife[i] = 0
        pmaxLife[i] = 120 + Math.random() * 180
      }
      ctx.fillStyle = "rgba(180,140,255,1)"
      let writeIdx = 0
      for (let i = 0; i < pCount; i++) {
        px[i] += pvx[i]; py[i] += pvy[i]; plife[i]++
        if (plife[i] > pmaxLife[i]) continue
        if (writeIdx !== i) { px[writeIdx] = px[i]; py[writeIdx] = py[i]; pvx[writeIdx] = pvx[i]; pvy[writeIdx] = pvy[i]; plife[writeIdx] = plife[i]; pmaxLife[writeIdx] = pmaxLife[i] }
        ctx.globalAlpha = (1 - plife[writeIdx] / pmaxLife[writeIdx]) * 0.15
        ctx.fillRect(px[writeIdx] - 1, py[writeIdx] - 1, 2, 2)
        writeIdx++
      }
      pCount = writeIdx
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])

  const [exiting, setExiting] = useState(false)
  const handleEnter = () => {
    setExiting(true)
    setTimeout(onEnter, 600)
  }

  return (
    <div className={`relative h-dvh w-screen overflow-hidden bg-[#0d0221] flex flex-col items-center justify-center transition-opacity duration-500 ${exiting ? "opacity-0" : ""}`}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${phase >= 1 ? "opacity-100" : "opacity-0"}`}
      />

      {/* Subtle scan lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.012]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
      }} />

      {/* Perspective grid */}
      <div className={`absolute bottom-0 left-0 right-0 h-[40%] transition-opacity duration-1000 ${phase >= 1 ? "opacity-[0.025]" : "opacity-0"}`} style={{
        backgroundImage: "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
        backgroundSize: "60px 40px",
        transform: "perspective(500px) rotateX(65deg)",
        transformOrigin: "bottom center",
        maskImage: "linear-gradient(to top, black 20%, transparent)",
        WebkitMaskImage: "linear-gradient(to top, black 20%, transparent)",
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Title */}
        <h1
          className={`font-mono text-5xl sm:text-7xl md:text-9xl font-bold uppercase tracking-[0.15em] sm:tracking-[0.3em] text-transparent bg-clip-text transition-all duration-1000 ${phase >= 2 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-90"}`}
          style={{
            backgroundImage: "linear-gradient(135deg, #e879f9, #a78bfa, #e879f9, #f9ab53)",
            backgroundSize: "300% 100%",
            animation: phase >= 2 ? "gradientShift 6s ease infinite" : "none",
            textShadow: "0 0 60px rgba(139,92,246,0.25)",
          }}
        >
          D4NCE
        </h1>

        {/* Divider */}
        <div className={`h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent mt-3 mb-2.5 transition-all duration-700 ${phase >= 3 ? "opacity-100 w-32" : "opacity-0 w-0"}`} />

        {/* Subtitle */}
        <p className={`text-[11px] sm:text-[13px] font-medium tracking-[0.3em] text-violet-300/60 uppercase transition-all duration-700 ${phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          AI-Powered DJ System
        </p>

        {/* Enter button */}
        <button
          onClick={handleEnter}
          className={`group relative mt-8 px-12 py-4 rounded-full transition-all duration-700 ${phase >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-fuchsia-500/10 via-violet-500/15 to-fuchsia-500/10 border border-violet-400/15 group-hover:border-violet-400/40 transition-all duration-500" />
          <span className="relative text-[11px] font-mono uppercase tracking-[0.35em] text-violet-200/80 group-hover:text-violet-100 transition-colors duration-300">
            Enter
          </span>
        </button>

        {/* Links */}
        <div className={`flex flex-col items-center gap-2 mt-6 transition-all duration-700 ${phase >= 4 ? "opacity-100" : "opacity-0"}`}>
          <a
            href="https://thomasou.com/index.html#projects"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-violet-300/40 hover:text-violet-300/70 transition-colors tracking-widest uppercase"
          >
            More Projects
          </a>
          <p className="text-[10px] text-violet-300/25">Built by Thomas Ou</p>
        </div>
      </div>
    </div>
  )
}

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
  const [libraryExpanded, setLibraryExpanded] = useState(false)
  const [aiExpanded, setAiExpanded] = useState(false)
  const [mixerExpanded, setMixerExpanded] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showLanding, setShowLanding] = useState(true)
  const [hasVisited, setHasVisited] = useState(false)
  const [mainFadingIn, setMainFadingIn] = useState(false)
  const [mainFadingOut, setMainFadingOut] = useState(false)

  const handleTourOpenCard = useCallback((cardId: string) => {
    if (cardId === "library") setLibraryExpanded(true)
    else if (cardId === "mixer") setMixerExpanded(true)
    else if (cardId === "ai-copilot") setAiExpanded(true)
  }, [])
  const [winSize, setWinSize] = useState({ w: 1280, h: 800 })

  useEffect(() => {
    const update = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  const [bpmA, setBpmA] = useState<number | null>(null)
  const [bpmB, setBpmB] = useState<number | null>(null)

  // Escape minimizes panels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (aiExpanded) setAiExpanded(false)
        else if (libraryExpanded) setLibraryExpanded(false)
        else if (mixerExpanded) setMixerExpanded(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [aiExpanded, libraryExpanded, mixerExpanded])

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
      const incomingTrack = incomingDeck === "A" ? trackA : trackB
      const incomingStructure = incomingDeck === "A" ? structureA : structureB
      const transDuration = plan.durationSeconds ?? 16

      // AI plan's incomingStartSeconds is the primary cue — it has full song structure context.
      // Fall back to metadata or structure analysis only when the plan says 0.
      const inMeta = incomingTrack ? getTrackMeta(incomingTrack) : null
      const structureEntry = incomingStructure ? findBestEntryPoint(incomingStructure, transDuration).time : 0
      const planCue = plan.incomingStartSeconds ?? 0
      const cuePoint = planCue > 0
        ? planCue
        : inMeta && inMeta.mixIn > 0
          ? inMeta.mixIn
          : structureEntry > 0
            ? structureEntry
            : 0

      // Pre-set crossfader to safe position (incoming silent) before delay
      let actualCrossfader = musicObject.crossfader
      if (!incomingPlaying && (incomingDeck === "A" ? trackA : trackB)) {
        const safeStart = outgoingDeck === "A" ? 0 : 1
        setCrossfade(safeStart)
        updateMusicObject({ crossfader: safeStart })
        actualCrossfader = safeStart
      }

      // Exit timing: AI plan's startDelay is primary — it has full song structure context.
      // Fall back to structure analysis or blend zone only when plan gives 0.
      const outgoingTrack = outgoingDeck === "A" ? trackA : trackB
      const outgoingStructure = outgoingDeck === "A" ? structureA : structureB
      const outgoingTime = outgoingDeck === "A" ? currentTimeA : currentTimeB
      const outgoingDuration = outgoingDeck === "A" ? durationA : durationB
      const planDelay = (plan.startDelay || 0) * 1000
      let effectiveDelay: number
      if (planDelay > 0) {
        effectiveDelay = planDelay
      } else if (outgoingStructure && outgoingTime !== undefined) {
        const exit = findNextExitPoint(outgoingStructure, outgoingTime, outgoingDuration)
        effectiveDelay = exit.delay * 1000
      } else {
        const blendZone = outgoingTrack ? getNextBlendZone(outgoingTrack, outgoingTime ?? 0) : null
        if (blendZone && outgoingTime !== undefined) {
          effectiveDelay = (blendZone.start - outgoingTime) * 1000
        } else {
          effectiveDelay = 0
        }
      }
      // Cap delay to prevent long dead waits
      effectiveDelay = Math.min(effectiveDelay, 30000)

      setTimeout(() => {
        // Seek and play incoming when the blend begins
        if (cuePoint > 0) seek(incomingDeck, cuePoint)
        if (!incomingPlaying && (incomingDeck === "A" ? trackA : trackB)) {
          play(incomingDeck)
        }

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
      }, Math.max(effectiveDelay, incomingPlaying ? 0 : 150))
    },
    [applyTransitionPlan, updateMusicObject, isPlayingA, isPlayingB, trackA, trackB, structureA, structureB, play, seek, setCrossfade, musicObject.crossfader, currentTimeA, currentTimeB, durationA, durationB],
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
    setAiExpanded(true)
  }, [])

  const handleEnter = useCallback(() => {
    setMainFadingIn(true)
    setShowLanding(false)
    setHasVisited(true)
    if (!isInitialized) initialize()
    setTimeout(() => setMainFadingIn(false), 600)
  }, [isInitialized, initialize])

  const handleLogoClick = useCallback(() => {
    setMainFadingOut(true)
    setTimeout(() => {
      setMainFadingOut(false)
      setShowLanding(true)
    }, 500)
  }, [])

  if (showLanding) {
    return <LandingPage onEnter={handleEnter} />
  }

  return (
    <ErrorBoundary>
      <div id="main-content" role="main" className={`relative h-dvh w-screen max-w-[100vw] overflow-hidden bg-[#0d0221] transition-opacity duration-500 ${mainFadingIn ? "animate-[fadeIn_600ms_ease-out]" : ""} ${mainFadingOut ? "opacity-0" : "opacity-100"}`}>
        {/* Fullscreen visualizer background */}
        <div className="absolute inset-0 z-0" data-tour-id="visualizer">
          <ThreeVisualizer analyserData={analyserData} musicObject={musicObject} transitionState={transitionState} />
        </div>


        {/* Top bar */}
        <TopBar
          musicObject={musicObject}
          onModeChange={(mode) => updateMusicObject({ visualizerMode: mode })}
          onColorSchemeChange={(scheme) => updateMusicObject({ colorScheme: scheme })}
          aiOpen={aiExpanded}
          onToggleAI={() => setAiExpanded(!aiExpanded)}
          libraryOpen={libraryExpanded}
          onToggleLibrary={() => setLibraryExpanded(!libraryExpanded)}
          mixerOpen={mixerExpanded}
          onToggleMixer={() => setMixerExpanded(!mixerExpanded)}
          onShowHelp={() => setShowHelp(true)}
          onLogoClick={handleLogoClick}
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

        {/* Floating draggable cards — always visible, start minimized */}
        <DraggableCard
          id="mixer"
          title="Mix"
          icon={<SlidersHorizontal className="h-2.5 w-2.5 text-violet-300/50" />}
          defaultPosition={{ x: 8, y: 108 }}
          defaultSize={{ width: 200, height: Math.min(480, winSize.h - 130) }}
          expanded={mixerExpanded}
          onToggle={() => setMixerExpanded(!mixerExpanded)}
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

        <DraggableCard
          id="library"
          title="Library"
          icon={<Library className="h-2.5 w-2.5 text-violet-300/50" />}
          defaultPosition={{ x: winSize.w - 248, y: 108 }}
          defaultSize={{ width: 240, height: Math.min(440, winSize.h - 130) }}
          expanded={libraryExpanded}
          onToggle={() => setLibraryExpanded(!libraryExpanded)}
        >
          <LibraryDrawer
            onLoadToDeck={handleLoadToDeck}
            trackA={trackA}
            trackB={trackB}
          />
        </DraggableCard>

        <DraggableCard
          id="ai-copilot"
          title="AI"
          icon={<Sparkles className="h-2.5 w-2.5 text-violet-300/50" />}
          defaultPosition={{ x: 8, y: winSize.h - 348 }}
          defaultSize={{ width: 340, height: 320 }}
          expanded={aiExpanded}
          onToggle={() => setAiExpanded(!aiExpanded)}
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

        <DjHelpModal open={showHelp} onClose={() => setShowHelp(false)} onOpenCard={handleTourOpenCard} />
      </div>
    </ErrorBoundary>
  )
}
