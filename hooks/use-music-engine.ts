"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { getMusicEngine, type MusicEngine, type TransitionState } from "@/lib/music-engine"
import { type MusicObject, type TransitionPlan, type CuePoint, type LoopRegion, type WaveformPeak, defaultMusicObject, getCamelotCompatibility } from "@/lib/types"
import type { KeyResult } from "@/lib/key-detector"
import type { SongStructure } from "@/lib/song-structure"
import { AudioContextBuffer } from "@/lib/audio-context-buffer"
import { analyzeFrequencyData } from "@/lib/audio-analyzer"

const defaultTransitionState: TransitionState = {
  isActive: false,
  progress: 0,
  startTime: 0,
  duration: 0,
  currentValues: {
    crossfader: 0,
    filterCutoff: 20000,
    filterQ: 1,
    reverb: 0,
    delay: 0,
    flangerMix: 0,
    deckAIsolation: { bass: 0, voice: 0, melody: 0 },
    deckBIsolation: { bass: 0, voice: 0, melody: 0 },
  },
}

export function useMusicEngine() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isPlayingA, setIsPlayingA] = useState(false)
  const [isPlayingB, setIsPlayingB] = useState(false)
  const [currentTimeA, setCurrentTimeA] = useState(0)
  const [currentTimeB, setCurrentTimeB] = useState(0)
  const [durationA, setDurationA] = useState(0)
  const [durationB, setDurationB] = useState(0)
  const [musicObject, setMusicObject] = useState<MusicObject>(defaultMusicObject)
  const [analyserData, setAnalyserData] = useState<{ frequency: Uint8Array; timeDomain: Uint8Array }>({
    frequency: new Uint8Array(1024),
    timeDomain: new Uint8Array(1024).fill(128),
  })
  const [transitionState, setTransitionState] = useState<TransitionState>(defaultTransitionState)

  // New state for advanced features
  const [keyA, setKeyA] = useState<KeyResult | null>(null)
  const [keyB, setKeyB] = useState<KeyResult | null>(null)
  const [waveformPeaksA, setWaveformPeaksA] = useState<WaveformPeak[] | null>(null)
  const [waveformPeaksB, setWaveformPeaksB] = useState<WaveformPeak[] | null>(null)
  const [cuePointsA, setCuePointsA] = useState<CuePoint[]>([])
  const [cuePointsB, setCuePointsB] = useState<CuePoint[]>([])
  const [loopA, setLoopA] = useState<LoopRegion | null>(null)
  const [loopB, setLoopB] = useState<LoopRegion | null>(null)
  const [structureA, setStructureA] = useState<SongStructure | null>(null)
  const [structureB, setStructureB] = useState<SongStructure | null>(null)

  const engineRef = useRef<MusicEngine | null>(null)
  const animationRef = useRef<number | null>(null)
  const transitionUnsubRef = useRef<(() => void) | null>(null)
  const contextBufferRef = useRef(new AudioContextBuffer())

  // Key compatibility score
  const keyCompatibility = keyA?.camelot && keyB?.camelot
    ? getCamelotCompatibility(keyA.camelot, keyB.camelot)
    : null

  useEffect(() => {
    engineRef.current = getMusicEngine()

    transitionUnsubRef.current = engineRef.current.onTransitionUpdate((state) => {
      setTransitionState(state)
      if (state.isActive) {
        setMusicObject((prev) => ({
          ...prev,
          crossfader: state.currentValues.crossfader,
          filter: { ...prev.filter, cutoff: state.currentValues.filterCutoff },
          reverbAmount: state.currentValues.reverb,
          delayAmount: state.currentValues.delay,
          fx: {
            ...prev.fx,
            flangerMix: state.currentValues.flangerMix,
          },
          tracks: {
            A: prev.tracks.A ? {
              ...prev.tracks.A,
              bassIsolation: state.currentValues.deckAIsolation.bass,
              voiceIsolation: state.currentValues.deckAIsolation.voice,
              melodyIsolation: state.currentValues.deckAIsolation.melody,
            } : null,
            B: prev.tracks.B ? {
              ...prev.tracks.B,
              bassIsolation: state.currentValues.deckBIsolation.bass,
              voiceIsolation: state.currentValues.deckBIsolation.voice,
              melodyIsolation: state.currentValues.deckBIsolation.melody,
            } : null,
          },
        }))
      }
    })

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (transitionUnsubRef.current) transitionUnsubRef.current()
    }
  }, [])

  const initialize = useCallback(async () => {
    if (!engineRef.current) return

    await engineRef.current.initialize()
    setIsInitialized(true)

    let lastMusicObjectRef: MusicObject | null = null
    const updateLoop = () => {
      if (engineRef.current) {
        const data = engineRef.current.getAnalyserData()
        setAnalyserData(data)
        setCurrentTimeA(engineRef.current.getCurrentTime("A"))
        setCurrentTimeB(engineRef.current.getCurrentTime("B"))
        setIsPlayingA(engineRef.current.isPlaying("A"))
        setIsPlayingB(engineRef.current.isPlaying("B"))

        const engineMusicObject = engineRef.current.getMusicObject()
        if (engineMusicObject && engineMusicObject !== lastMusicObjectRef) {
          lastMusicObjectRef = engineMusicObject
          setMusicObject(engineMusicObject)
        }

        // Feed audio context buffer (self-throttled to 500ms)
        const snapshot = analyzeFrequencyData(data.frequency)
        const mo = engineMusicObject ?? lastMusicObjectRef
        contextBufferRef.current.push(
          snapshot,
          mo?.crossfader ?? 0.5,
          engineRef.current.getBPM("A"),
          engineRef.current.getBPM("B"),
          engineRef.current.getKey("A")?.camelot ?? null,
          engineRef.current.getKey("B")?.camelot ?? null,
        )
      }
      animationRef.current = requestAnimationFrame(updateLoop)
    }
    animationRef.current = requestAnimationFrame(updateLoop)
  }, [])

  const loadTrack = useCallback(
    async (deck: "A" | "B", url: string) => {
      if (!engineRef.current) return

      if (!isInitialized) await initialize()

      await engineRef.current.loadTrack(deck, url)
      contextBufferRef.current.addEvent("track_loaded", `Deck ${deck}: ${url.split("/").pop() ?? url}`)

      if (deck === "A") {
        setDurationA(engineRef.current.getDuration("A"))
      } else {
        setDurationB(engineRef.current.getDuration("B"))
      }

      // Poll for analysis results (BPM, key, waveform, structure)
      const setKey = deck === "A" ? setKeyA : setKeyB
      const setWaveform = deck === "A" ? setWaveformPeaksA : setWaveformPeaksB
      const setStructure = deck === "A" ? setStructureA : setStructureB
      const setCues = deck === "A" ? setCuePointsA : setCuePointsB
      const setLoop = deck === "A" ? setLoopA : setLoopB

      // Reset deck state
      setCues([])
      setLoop(null)
      setStructure(null)

      let attempts = 0
      const interval = setInterval(() => {
        if (!engineRef.current) { clearInterval(interval); return }

        const key = engineRef.current.getKey(deck)
        const peaks = engineRef.current.getWaveformPeaks(deck)
        const structure = engineRef.current.getSongStructure(deck)

        if (key) setKey(key)
        if (peaks) setWaveform(peaks)
        if (structure) setStructure(structure)

        if ((key && peaks && structure) || attempts >= 40) {
          clearInterval(interval)
        }
        attempts++
      }, 250)
    },
    [isInitialized, initialize],
  )

  const play = useCallback((deck?: "A" | "B") => {
    engineRef.current?.play(deck)
  }, [])

  const pause = useCallback((deck?: "A" | "B") => {
    engineRef.current?.pause(deck)
  }, [])

  const seek = useCallback((deck: "A" | "B", time: number) => {
    engineRef.current?.seek(deck, time)
  }, [])

  const setCrossfade = useCallback((value: number) => {
    if (!engineRef.current) return
    engineRef.current.setCrossfade(value)
    const updated = engineRef.current.getMusicObject()
    if (updated) setMusicObject(updated)
  }, [])

  const updateMusicObject = useCallback((updates: Partial<MusicObject>) => {
    if (engineRef.current) {
      engineRef.current.updateMusicObject(updates)
      const updated = engineRef.current.getMusicObject()
      if (updated) { setMusicObject(updated); return }
    }
    setMusicObject(prev => ({ ...prev, ...updates } as MusicObject))
  }, [])

  const applyTransitionPlan = useCallback((plan: TransitionPlan) => {
    engineRef.current?.applyTransitionPlan(plan)
    contextBufferRef.current.addEvent("transition_start", `${plan.technique ?? "blend"} ${plan.durationSeconds}s`)
  }, [])

  const cancelTransition = useCallback(() => {
    engineRef.current?.cancelTransition()
  }, [])

  const hasTrack = useCallback((deck: "A" | "B") => {
    return engineRef.current?.hasTrack(deck) ?? false
  }, [])

  const getAnalyserData = useCallback(() => {
    if (!engineRef.current) {
      return { frequency: new Uint8Array(1024), timeDomain: new Uint8Array(1024) }
    }
    return engineRef.current.getAnalyserData()
  }, [])

  // --- Cue Points ---
  const addCuePoint = useCallback((deck: "A" | "B", time: number) => {
    if (!engineRef.current) return
    const cue = engineRef.current.addCuePoint(deck, time)
    const setCues = deck === "A" ? setCuePointsA : setCuePointsB
    setCues(prev => [...prev, cue])
  }, [])

  const jumpToCue = useCallback((deck: "A" | "B", cueId: string) => {
    engineRef.current?.jumpToCue(deck, cueId)
  }, [])

  const removeCuePoint = useCallback((deck: "A" | "B", cueId: string) => {
    if (!engineRef.current) return
    engineRef.current.removeCuePoint(deck, cueId)
    const setCues = deck === "A" ? setCuePointsA : setCuePointsB
    setCues(prev => prev.filter(c => c.id !== cueId))
  }, [])

  // --- Looping ---
  const setBeatLoop = useCallback((deck: "A" | "B", beats: number) => {
    if (!engineRef.current) return
    engineRef.current.setBeatLoop(deck, beats)
    const loop = engineRef.current.getLoop(deck)
    const setLoop = deck === "A" ? setLoopA : setLoopB
    setLoop(loop)
  }, [])

  const clearLoop = useCallback((deck: "A" | "B") => {
    if (!engineRef.current) return
    engineRef.current.clearLoop(deck)
    const setLoop = deck === "A" ? setLoopA : setLoopB
    setLoop(null)
  }, [])

  const toggleLoop = useCallback((deck: "A" | "B") => {
    if (!engineRef.current) return
    engineRef.current.toggleLoop(deck)
    const loop = engineRef.current.getLoop(deck)
    const setLoop = deck === "A" ? setLoopA : setLoopB
    setLoop(loop ? { ...loop } : null)
  }, [])

  // --- Effects ---
  const vinylBrake = useCallback((deck: "A" | "B") => {
    engineRef.current?.vinylBrake(deck)
  }, [])

  const spinback = useCallback((deck: "A" | "B") => {
    engineRef.current?.spinback(deck)
  }, [])

  const getAudioContext = useCallback(() => {
    return contextBufferRef.current.getStructured()
  }, [])

  return {
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
    hasTrack,
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
    musicEngine: engineRef.current,
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
    removeCuePoint,
    setBeatLoop,
    clearLoop,
    toggleLoop,
    vinylBrake,
    spinback,
    getAudioContext,
  }
}
