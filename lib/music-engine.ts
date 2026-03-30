// Web Audio API based music engine
import type { MusicObject, TransitionPlan, CuePoint, LoopRegion, WaveformPeak } from "./types"
import { defaultMusicObject } from "./types"
import { BPMDetector } from "./bpm-detector"
import { KeyDetector, type KeyResult } from "./key-detector"
import { generateWaveformPeaks } from "./waveform-generator"

export interface TransitionState {
  isActive: boolean
  progress: number
  startTime: number
  duration: number
  currentValues: {
    crossfader: number
    filterCutoff: number
    filterQ: number
    reverb: number
    delay: number
    flangerMix: number
    deckAIsolation: { bass: number; voice: number; melody: number }
    deckBIsolation: { bass: number; voice: number; melody: number }
  }
}

export type TransitionCallback = (state: TransitionState) => void

interface DeckState {
  buffer: AudioBuffer | null
  gain: GainNode | null
  panNode: StereoPannerNode | null
  eqLow: BiquadFilterNode | null
  eqMid: BiquadFilterNode | null
  eqHigh: BiquadFilterNode | null
  bassIsolate: BiquadFilterNode | null
  voiceIsolate: BiquadFilterNode | null
  melodyIsolate: BiquadFilterNode | null
  bassIsolateGain: GainNode | null
  voiceIsolateGain: GainNode | null
  melodyIsolateGain: GainNode | null
  isoMix: GainNode | null
  dryPath: GainNode | null
  detectedBPM: number | null
  detectedKey: KeyResult | null
  waveformPeaks: WaveformPeak[] | null
  cuePoints: CuePoint[]
  loop: LoopRegion | null
  isPlaying: boolean
  startTime: number
  pauseTime: number
}

function createDeckState(): DeckState {
  return {
    buffer: null,
    gain: null,
    panNode: null,
    eqLow: null,
    eqMid: null,
    eqHigh: null,
    bassIsolate: null,
    voiceIsolate: null,
    melodyIsolate: null,
    bassIsolateGain: null,
    voiceIsolateGain: null,
    melodyIsolateGain: null,
    isoMix: null,
    dryPath: null,
    detectedBPM: null,
    detectedKey: null,
    waveformPeaks: null,
    cuePoints: [],
    loop: null,
    isPlaying: false,
    startTime: 0,
    pauseTime: 0,
  }
}

export class MusicEngine {
  private audioContext: AudioContext | null = null
  private activeSources: { A: AudioBufferSourceNode | null; B: AudioBufferSourceNode | null } = { A: null, B: null }
  private deckA: DeckState = createDeckState()
  private deckB: DeckState = createDeckState()

  private masterGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private filter: BiquadFilterNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private delayNode: DelayNode | null = null
  private delayFeedback: GainNode | null = null
  private delayWet: GainNode | null = null
  private reverbNode: ConvolverNode | null = null
  private reverbGain: GainNode | null = null
  private dryGain: GainNode | null = null

  // Flanger nodes
  private flangerDelay: DelayNode | null = null
  private flangerLFO: OscillatorNode | null = null
  private flangerLFOGain: GainNode | null = null
  private flangerWet: GainNode | null = null
  private flangerDry: GainNode | null = null
  private flangerMerge: GainNode | null = null

  // Pre-allocated analyser buffers (avoids 120 allocations/sec)
  private analyserFreqBuffer: Uint8Array | null = null
  private analyserTimeBuffer: Uint8Array | null = null

  private musicObject: MusicObject = { ...defaultMusicObject }
  private transitionInterval: ReturnType<typeof setInterval> | null = null
  private playLock = { A: false, B: false }
  private loopTimeouts: { A: ReturnType<typeof setTimeout> | null; B: ReturnType<typeof setTimeout> | null } = { A: null, B: null }
  private transitionState: TransitionState = {
    isActive: false,
    progress: 0,
    startTime: 0,
    duration: 0,
    currentValues: {
      crossfader: 0.5,
      filterCutoff: 20000,
      filterQ: 1,
      reverb: 0,
      delay: 0,
      flangerMix: 0,
      deckAIsolation: { bass: 0, voice: 0, melody: 0 },
      deckBIsolation: { bass: 0, voice: 0, melody: 0 },
    },
  }
  private transitionCallbacks: Set<TransitionCallback> = new Set()

  async initialize(): Promise<void> {
    if (this.audioContext) return

    this.audioContext = new AudioContext()

    // Create master chain
    this.masterGain = this.audioContext.createGain()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8

    // Pre-allocate analyser buffers
    this.analyserFreqBuffer = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyserTimeBuffer = new Uint8Array(this.analyser.frequencyBinCount)

    // Master compressor/limiter to prevent clipping
    this.compressor = this.audioContext.createDynamicsCompressor()
    this.compressor.threshold.value = -6
    this.compressor.knee.value = 10
    this.compressor.ratio.value = 4
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.15

    // Filter
    this.filter = this.audioContext.createBiquadFilter()
    this.filter.type = "lowpass"
    this.filter.frequency.value = 20000
    this.filter.Q.value = 1

    // Delay with feedback
    this.delayNode = this.audioContext.createDelay(2)
    this.delayNode.delayTime.value = 0.3
    this.delayFeedback = this.audioContext.createGain()
    this.delayFeedback.gain.value = 0
    this.delayWet = this.audioContext.createGain()
    this.delayWet.gain.value = 0

    // Reverb (improved impulse response)
    this.reverbNode = this.audioContext.createConvolver()
    this.reverbGain = this.audioContext.createGain()
    this.reverbGain.gain.value = 0
    this.dryGain = this.audioContext.createGain()
    this.dryGain.gain.value = 1

    await this.createReverbImpulse()

    // Flanger setup
    this.flangerDelay = this.audioContext.createDelay(0.02)
    this.flangerDelay.delayTime.value = 0.005
    this.flangerLFO = this.audioContext.createOscillator()
    this.flangerLFO.type = "sine"
    this.flangerLFO.frequency.value = 0.25
    this.flangerLFOGain = this.audioContext.createGain()
    this.flangerLFOGain.gain.value = 0.002
    this.flangerWet = this.audioContext.createGain()
    this.flangerWet.gain.value = 0
    this.flangerDry = this.audioContext.createGain()
    this.flangerDry.gain.value = 1
    this.flangerMerge = this.audioContext.createGain()

    // Flanger LFO modulates delay time
    this.flangerLFO.connect(this.flangerLFOGain)
    this.flangerLFOGain.connect(this.flangerDelay.delayTime)
    this.flangerLFO.start()

    // Signal routing:
    // filter → flangerDry → flangerMerge
    // filter → flangerDelay → flangerWet → flangerMerge
    // flangerMerge → dryGain → masterGain
    // flangerMerge → reverbNode → reverbGain → masterGain
    // flangerMerge → delayWet → delayNode → (feedback) → masterGain

    this.filter.connect(this.flangerDry)
    this.flangerDry.connect(this.flangerMerge)

    this.filter.connect(this.flangerDelay)
    this.flangerDelay.connect(this.flangerWet)
    this.flangerWet.connect(this.flangerMerge)

    this.flangerMerge.connect(this.dryGain)
    this.dryGain.connect(this.masterGain)

    this.flangerMerge.connect(this.reverbNode)
    this.reverbNode.connect(this.reverbGain)
    this.reverbGain.connect(this.masterGain)

    this.flangerMerge.connect(this.delayWet)
    this.delayWet.connect(this.delayNode)
    this.delayNode.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delayNode)
    this.delayNode.connect(this.masterGain)

    // Master chain: masterGain → compressor → analyser → destination
    this.masterGain.connect(this.compressor)
    this.compressor.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)

    this.initializeDeck("A")
    this.initializeDeck("B")
  }

  private async createReverbImpulse(): Promise<void> {
    if (!this.audioContext || !this.reverbNode) return

    const sampleRate = this.audioContext.sampleRate
    const length = sampleRate * 2.5 // 2.5 seconds
    const impulse = this.audioContext.createBuffer(2, length, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)

      // Multi-layer reverb: early reflections + diffuse tail
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate
        const noise = Math.random() * 2 - 1

        // Early reflections (first 80ms) — discrete echoes
        let early = 0
        if (t < 0.08) {
          const reflections = [0.012, 0.019, 0.028, 0.037, 0.048, 0.062, 0.075]
          for (const rt of reflections) {
            if (Math.abs(t - rt) < 0.001) {
              early = (Math.random() * 2 - 1) * 0.6 * (1 - rt / 0.08)
            }
          }
        }

        // Diffuse tail with exponential decay
        const decay = Math.exp(-3.5 * t)
        // Add slight frequency-dependent damping (highs decay faster)
        const highDamp = Math.exp(-6 * t)
        const diffuse = noise * decay * 0.35

        // Stereo decorrelation via channel-specific random
        const stereoOffset = channel === 0 ? 0.97 : 1.03

        channelData[i] = (early + diffuse * stereoOffset) * (0.7 + highDamp * 0.3)
      }
    }

    this.reverbNode.buffer = impulse
  }

  private initializeDeck(deck: "A" | "B"): void {
    if (!this.audioContext || !this.filter) return

    const d = deck === "A" ? this.deckA : this.deckB

    d.gain = this.audioContext.createGain()
    d.panNode = this.audioContext.createStereoPanner()
    d.eqLow = this.audioContext.createBiquadFilter()
    d.eqMid = this.audioContext.createBiquadFilter()
    d.eqHigh = this.audioContext.createBiquadFilter()

    // EQ setup — industry-standard DJ frequencies
    d.eqLow.type = "lowshelf"
    d.eqLow.frequency.value = 320
    d.eqLow.gain.value = 0

    d.eqMid.type = "peaking"
    d.eqMid.frequency.value = 1000
    d.eqMid.Q.value = 0.7
    d.eqMid.gain.value = 0

    d.eqHigh.type = "highshelf"
    d.eqHigh.frequency.value = 3200
    d.eqHigh.gain.value = 0

    // Isolation filters
    d.bassIsolate = this.audioContext.createBiquadFilter()
    d.bassIsolate.type = "lowpass"
    d.bassIsolate.frequency.value = 250
    d.bassIsolate.Q.value = 1
    d.bassIsolateGain = this.audioContext.createGain()
    d.bassIsolateGain.gain.value = 0

    d.voiceIsolate = this.audioContext.createBiquadFilter()
    d.voiceIsolate.type = "bandpass"
    d.voiceIsolate.frequency.value = 1850
    d.voiceIsolate.Q.value = 0.7
    d.voiceIsolateGain = this.audioContext.createGain()
    d.voiceIsolateGain.gain.value = 0

    d.melodyIsolate = this.audioContext.createBiquadFilter()
    d.melodyIsolate.type = "highpass"
    d.melodyIsolate.frequency.value = 1000
    d.melodyIsolate.Q.value = 1
    d.melodyIsolateGain = this.audioContext.createGain()
    d.melodyIsolateGain.gain.value = 0

    // Routing
    d.eqLow.connect(d.eqMid)
    d.eqMid.connect(d.eqHigh)

    d.isoMix = this.audioContext.createGain()
    d.isoMix.gain.value = 1

    d.dryPath = this.audioContext.createGain()
    d.dryPath.gain.value = 1

    // Isolation filters through isoMix
    d.eqHigh.connect(d.bassIsolate)
    d.bassIsolate.connect(d.bassIsolateGain)
    d.bassIsolateGain.connect(d.isoMix)

    d.eqHigh.connect(d.voiceIsolate)
    d.voiceIsolate.connect(d.voiceIsolateGain)
    d.voiceIsolateGain.connect(d.isoMix)

    d.eqHigh.connect(d.melodyIsolate)
    d.melodyIsolate.connect(d.melodyIsolateGain)
    d.melodyIsolateGain.connect(d.isoMix)

    // Dry path (unfiltered signal when no isolation active)
    d.eqHigh.connect(d.dryPath)

    // Both paths merge into pan → gain → master filter
    d.isoMix.connect(d.panNode)
    d.dryPath.connect(d.panNode)
    d.panNode.connect(d.gain)
    d.gain.connect(this.filter)
  }

  async loadTrack(deck: "A" | "B", url: string): Promise<void> {
    if (!this.audioContext) await this.initialize()
    if (!this.audioContext) throw new Error("Audio context not initialized")

    const d = deck === "A" ? this.deckA : this.deckB

    this.stopDeck(deck)

    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    d.buffer = await this.audioContext.decodeAudioData(arrayBuffer)
    d.pauseTime = 0
    d.cuePoints = []
    d.loop = null

    // Run analysis in parallel (BPM, key detection, waveform generation)
    this.analyzeTrack(deck, d.buffer)
  }

  private async analyzeTrack(deck: "A" | "B", buffer: AudioBuffer): Promise<void> {
    const d = deck === "A" ? this.deckA : this.deckB

    // BPM detection
    try {
      const bpmDetector = new BPMDetector(buffer.sampleRate)
      d.detectedBPM = await bpmDetector.detectBPM(buffer)
    } catch {
      d.detectedBPM = null
    }

    // Key detection
    try {
      const keyDetector = new KeyDetector(buffer.sampleRate)
      d.detectedKey = await keyDetector.detectKey(buffer)
    } catch {
      d.detectedKey = null
    }

    // Waveform generation
    try {
      d.waveformPeaks = generateWaveformPeaks(buffer)
    } catch {
      d.waveformPeaks = null
    }
  }

  getBPM(deck: "A" | "B"): number | null {
    return (deck === "A" ? this.deckA : this.deckB).detectedBPM
  }

  getKey(deck: "A" | "B"): KeyResult | null {
    return (deck === "A" ? this.deckA : this.deckB).detectedKey
  }

  getWaveformPeaks(deck: "A" | "B"): WaveformPeak[] | null {
    return (deck === "A" ? this.deckA : this.deckB).waveformPeaks
  }

  // --- Cue Points ---
  addCuePoint(deck: "A" | "B", time: number, label?: string, color?: string): CuePoint {
    const d = deck === "A" ? this.deckA : this.deckB
    const cue: CuePoint = {
      id: `cue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time,
      label: label ?? `Cue ${d.cuePoints.length + 1}`,
      color: color ?? ["#a78bfa", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#f472b6", "#6366f1", "#14b8a6"][d.cuePoints.length % 8],
    }
    d.cuePoints.push(cue)
    return cue
  }

  removeCuePoint(deck: "A" | "B", cueId: string): void {
    const d = deck === "A" ? this.deckA : this.deckB
    d.cuePoints = d.cuePoints.filter(c => c.id !== cueId)
  }

  jumpToCue(deck: "A" | "B", cueId: string): void {
    const d = deck === "A" ? this.deckA : this.deckB
    const cue = d.cuePoints.find(c => c.id === cueId)
    if (cue) this.seek(deck, cue.time)
  }

  getCuePoints(deck: "A" | "B"): CuePoint[] {
    return (deck === "A" ? this.deckA : this.deckB).cuePoints
  }

  // --- Looping ---
  setLoop(deck: "A" | "B", startTime: number, endTime: number): void {
    const d = deck === "A" ? this.deckA : this.deckB
    d.loop = { startTime, endTime, active: true }
    this.scheduleLoopReturn(deck)
  }

  toggleLoop(deck: "A" | "B"): void {
    const d = deck === "A" ? this.deckA : this.deckB
    if (!d.loop) return
    d.loop.active = !d.loop.active
    if (d.loop.active) {
      this.scheduleLoopReturn(deck)
    } else {
      this.clearLoopTimeout(deck)
    }
  }

  clearLoop(deck: "A" | "B"): void {
    const d = deck === "A" ? this.deckA : this.deckB
    d.loop = null
    this.clearLoopTimeout(deck)
  }

  getLoop(deck: "A" | "B"): LoopRegion | null {
    return (deck === "A" ? this.deckA : this.deckB).loop
  }

  // Beat-synced loop: creates loop of N beats based on detected BPM
  setBeatLoop(deck: "A" | "B", beats: number): void {
    const d = deck === "A" ? this.deckA : this.deckB
    const bpm = d.detectedBPM
    if (!bpm) return

    const beatDuration = 60 / bpm
    const currentTime = this.getCurrentTime(deck)
    const loopLength = beatDuration * beats

    this.setLoop(deck, currentTime, currentTime + loopLength)
  }

  private scheduleLoopReturn(deck: "A" | "B"): void {
    this.clearLoopTimeout(deck)
    const d = deck === "A" ? this.deckA : this.deckB
    if (!d.loop?.active || !d.isPlaying) return

    const currentTime = this.getCurrentTime(deck)

    if (currentTime >= d.loop.endTime) {
      // Already past loop end, jump back now
      this.seek(deck, d.loop.startTime)
      // Re-schedule after seeking
      this.loopTimeouts[deck] = setTimeout(() => this.scheduleLoopReturn(deck), 10)
      return
    }

    // Account for playback rate in timeout calculation
    const trackSettings = this.musicObject?.tracks?.[deck]
    const rate = trackSettings?.playbackRate ?? 1
    const timeUntilEnd = d.loop.endTime - currentTime
    // Use a shorter check interval to avoid drift — poll at ~20ms before expected end
    const waitMs = Math.max(5, (timeUntilEnd / rate) * 1000 - 20)

    this.loopTimeouts[deck] = setTimeout(() => {
      if (!d.loop?.active || !d.isPlaying) return

      const now = this.getCurrentTime(deck)
      if (now >= d.loop.endTime - 0.02) {
        // Close enough to end — jump back
        this.seek(deck, d.loop.startTime)
        this.scheduleLoopReturn(deck)
      } else {
        // Not there yet (rate changed mid-loop?) — re-check soon
        this.scheduleLoopReturn(deck)
      }
    }, waitMs)
  }

  private clearLoopTimeout(deck: "A" | "B"): void {
    const timeout = this.loopTimeouts[deck]
    if (timeout !== null) {
      clearTimeout(timeout)
      this.loopTimeouts[deck] = null
    }
  }

  // --- Playback ---
  private stopDeck(deck: "A" | "B"): void {
    const d = deck === "A" ? this.deckA : this.deckB
    const activeSource = this.activeSources[deck]

    if (activeSource) {
      try {
        activeSource.onended = null
        activeSource.stop()
        activeSource.disconnect()
      } catch {
        // Source may already be stopped
      }
      this.activeSources[deck] = null
    }

    this.clearLoopTimeout(deck)
    d.isPlaying = false
  }

  play(deck?: "A" | "B"): void {
    if (!this.audioContext) return

    const decks = deck ? [deck] : (["A", "B"] as const)

    for (const d of decks) {
      if (this.playLock[d]) continue

      const deckObj = d === "A" ? this.deckA : this.deckB

      if (!deckObj.buffer || !deckObj.eqLow) continue
      if (deckObj.isPlaying) continue
      if (this.activeSources[d]) this.stopDeck(d)

      this.playLock[d] = true
      deckObj.isPlaying = true

      try {
        const source = this.audioContext.createBufferSource()
        source.buffer = deckObj.buffer
        source.connect(deckObj.eqLow)

        const trackSettings = this.musicObject?.tracks?.[d]
        if (trackSettings?.playbackRate) {
          source.playbackRate.value = trackSettings.playbackRate
        }

        this.activeSources[d] = source

        source.start(0, deckObj.pauseTime)
        deckObj.startTime = this.audioContext.currentTime - deckObj.pauseTime

        this.playLock[d] = false

        const currentSource = source
        source.onended = () => {
          if (this.activeSources[d] === currentSource) {
            deckObj.isPlaying = false
            deckObj.pauseTime = 0
            this.activeSources[d] = null
          }
        }

        // Schedule loop return if active
        if (deckObj.loop?.active) {
          this.scheduleLoopReturn(d)
        }
      } catch {
        this.playLock[d] = false
        deckObj.isPlaying = false
      }
    }
  }

  pause(deck?: "A" | "B"): void {
    if (!this.audioContext) return

    const decks = deck ? [deck] : (["A", "B"] as const)

    for (const d of decks) {
      const deckObj = d === "A" ? this.deckA : this.deckB
      const activeSource = this.activeSources[d]

      if (!deckObj.isPlaying || !activeSource) continue

      deckObj.pauseTime = this.audioContext.currentTime - deckObj.startTime
      this.clearLoopTimeout(d)

      try {
        activeSource.onended = null
        activeSource.stop()
        activeSource.disconnect()
      } catch {
        // Source may already be stopped
      }

      this.activeSources[d] = null
      deckObj.isPlaying = false
    }
  }

  // --- Vinyl Brake Effect ---
  vinylBrake(deck: "A" | "B", duration = 1.5): void {
    if (!this.audioContext) return
    const source = this.activeSources[deck]
    if (!source) return

    const now = this.audioContext.currentTime
    source.playbackRate.cancelScheduledValues(now)
    source.playbackRate.setValueAtTime(source.playbackRate.value, now)
    source.playbackRate.exponentialRampToValueAtTime(0.01, now + duration)

    setTimeout(() => {
      this.pause(deck)
      // Reset playback rate
      const trackSettings = this.musicObject?.tracks?.[deck]
      if (source === this.activeSources[deck]) {
        source.playbackRate.cancelScheduledValues(0)
        source.playbackRate.value = trackSettings?.playbackRate ?? 1
      }
    }, duration * 1000)
  }

  // --- Vinyl Spinback Effect ---
  spinback(deck: "A" | "B", duration = 0.8): void {
    if (!this.audioContext) return
    const source = this.activeSources[deck]
    if (!source) return

    const now = this.audioContext.currentTime
    source.playbackRate.cancelScheduledValues(now)
    source.playbackRate.setValueAtTime(source.playbackRate.value, now)
    // Ramp to negative-like effect by going to near zero quickly then stopping
    source.playbackRate.exponentialRampToValueAtTime(0.01, now + duration * 0.3)

    setTimeout(() => {
      this.pause(deck)
      const trackSettings = this.musicObject?.tracks?.[deck]
      if (source === this.activeSources[deck]) {
        source.playbackRate.cancelScheduledValues(0)
        source.playbackRate.value = trackSettings?.playbackRate ?? 1
      }
    }, duration * 1000)
  }

  // --- Crossfade ---
  setCrossfade(value: number): void {
    this.musicObject = { ...this.musicObject, crossfader: value }

    if (!this.deckA.gain || !this.deckB.gain) return

    // Constant-power crossfade using sqrt curves (no volume bump at center)
    const crossfadeGainA = Math.sqrt(1 - value)
    const crossfadeGainB = Math.sqrt(value)

    const deckGainA = this.musicObject.tracks.A?.gain ?? 1
    const deckGainB = this.musicObject.tracks.B?.gain ?? 1

    this.deckA.gain.gain.value = crossfadeGainA * deckGainA
    this.deckB.gain.gain.value = crossfadeGainB * deckGainB
  }

  updateMusicObject(obj: Partial<MusicObject>): void {
    this.musicObject = { ...this.musicObject, ...obj } as MusicObject

    if (!this.audioContext) return

    // Master gain
    if (obj.masterGain !== undefined && this.masterGain && isFinite(obj.masterGain)) {
      this.masterGain.gain.value = obj.masterGain
    }

    // Crossfader
    if (obj.crossfader !== undefined) {
      this.setCrossfade(obj.crossfader)
    }

    // EQ (master — applies to both decks)
    if (obj.eq) {
      for (const deck of [this.deckA, this.deckB]) {
        if (deck.eqLow && isFinite(obj.eq.low)) deck.eqLow.gain.value = obj.eq.low
        if (deck.eqMid && isFinite(obj.eq.mid)) deck.eqMid.gain.value = obj.eq.mid
        if (deck.eqHigh && isFinite(obj.eq.high)) deck.eqHigh.gain.value = obj.eq.high
      }
    }

    // Per-deck EQ
    if (obj.perDeckEq) {
      for (const deckKey of ["A", "B"] as const) {
        const eq = obj.perDeckEq[deckKey]
        const deck = deckKey === "A" ? this.deckA : this.deckB
        if (eq && deck.eqLow) {
          if (isFinite(eq.low)) deck.eqLow.gain.value = eq.low
          if (isFinite(eq.mid) && deck.eqMid) deck.eqMid.gain.value = eq.mid
          if (isFinite(eq.high) && deck.eqHigh) deck.eqHigh.gain.value = eq.high
        }
      }
    }

    // Filter
    if (obj.filter && this.filter) {
      this.filter.type = obj.filter.type
      if (isFinite(obj.filter.cutoff)) this.filter.frequency.value = obj.filter.cutoff
      if (isFinite(obj.filter.q)) this.filter.Q.value = obj.filter.q
    }

    // Reverb
    if (obj.reverbAmount !== undefined && this.reverbGain && this.dryGain && isFinite(obj.reverbAmount)) {
      this.reverbGain.gain.value = obj.reverbAmount
      this.dryGain.gain.value = 1 - obj.reverbAmount * 0.3
    }

    // Delay
    if (obj.delayAmount !== undefined && this.delayFeedback && this.delayWet && isFinite(obj.delayAmount)) {
      this.delayFeedback.gain.value = obj.delayAmount * 0.6
      this.delayWet.gain.value = obj.delayAmount
    }

    // FX (Flanger)
    if (obj.fx && this.flangerLFO && this.flangerLFOGain && this.flangerWet && this.flangerDry) {
      if (isFinite(obj.fx.flangerRate)) this.flangerLFO.frequency.value = obj.fx.flangerRate
      if (isFinite(obj.fx.flangerDepth)) this.flangerLFOGain.gain.value = obj.fx.flangerDepth
      if (isFinite(obj.fx.flangerMix)) {
        this.flangerWet.gain.value = obj.fx.flangerMix
        this.flangerDry.gain.value = 1 - obj.fx.flangerMix * 0.5
      }
    }

    // Track settings
    if (obj.tracks) {
      for (const deckKey of ["A", "B"] as const) {
        const settings = obj.tracks[deckKey]
        const deck = deckKey === "A" ? this.deckA : this.deckB

        if (settings) {
          if (settings.gain !== undefined && deck.gain && isFinite(settings.gain)) {
            this.setCrossfade(this.musicObject.crossfader ?? 0.5)
          }
          if (settings.pan !== undefined && deck.panNode && isFinite(settings.pan)) {
            deck.panNode.pan.value = settings.pan
          }
          if (settings.playbackRate !== undefined && isFinite(settings.playbackRate)) {
            const source = this.activeSources[deckKey]
            if (source) source.playbackRate.value = settings.playbackRate
          }

          if (settings.bassIsolation !== undefined && deck.bassIsolateGain && isFinite(settings.bassIsolation)) {
            deck.bassIsolateGain.gain.value = settings.bassIsolation
          }
          if (settings.voiceIsolation !== undefined && deck.voiceIsolateGain && isFinite(settings.voiceIsolation)) {
            deck.voiceIsolateGain.gain.value = settings.voiceIsolation
          }
          if (settings.melodyIsolation !== undefined && deck.melodyIsolateGain && isFinite(settings.melodyIsolation)) {
            deck.melodyIsolateGain.gain.value = settings.melodyIsolation
          }

          // Mute dry path when any isolation is active
          const anyIsoActive = (deck.bassIsolateGain?.gain.value ?? 0) > 0 ||
            (deck.voiceIsolateGain?.gain.value ?? 0) > 0 ||
            (deck.melodyIsolateGain?.gain.value ?? 0) > 0
          if (deck.dryPath) {
            deck.dryPath.gain.value = anyIsoActive ? 0 : 1
          }
        }
      }
    }
  }

  // --- Transitions ---
  onTransitionUpdate(callback: TransitionCallback): () => void {
    this.transitionCallbacks.add(callback)
    callback(this.transitionState)
    return () => {
      this.transitionCallbacks.delete(callback)
    }
  }

  getTransitionState(): TransitionState {
    return { ...this.transitionState }
  }

  cancelTransition(): void {
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval)
      this.transitionInterval = null
    }

    // Reset isolation gains to prevent stems being stuck in isolated state
    for (const d of [this.deckA, this.deckB]) {
      if (d.bassIsolateGain) d.bassIsolateGain.gain.value = 0
      if (d.voiceIsolateGain) d.voiceIsolateGain.gain.value = 0
      if (d.melodyIsolateGain) d.melodyIsolateGain.gain.value = 0
      if (d.dryPath) d.dryPath.gain.value = 1
    }
    // Reset flanger
    if (this.flangerWet) this.flangerWet.gain.value = 0
    if (this.flangerDry) this.flangerDry.gain.value = 1

    this.transitionState = {
      ...this.transitionState,
      isActive: false,
      progress: 0,
    }
    this.notifyTransitionCallbacks()
  }

  private isNotifying = false
  private notifyTransitionCallbacks(): void {
    if (this.isNotifying) return
    this.isNotifying = true
    const state = { ...this.transitionState }
    this.transitionCallbacks.forEach((cb) => cb(state))
    this.isNotifying = false
  }

  applyTransitionPlan(plan: TransitionPlan): void {
    if (!plan.crossfadeAutomation || plan.crossfadeAutomation.length < 2) {
      plan.crossfadeAutomation = [
        { t: 0.0, value: 0.0 },
        { t: 0.2, value: 0.1 },
        { t: 0.4, value: 0.3 },
        { t: 0.6, value: 0.7 },
        { t: 0.8, value: 0.9 },
        { t: 1.0, value: 1.0 },
      ]
    }

    if (this.transitionInterval) {
      clearInterval(this.transitionInterval)
      this.transitionInterval = null
    }

    const startTime = Date.now()
    const duration = plan.durationSeconds * 1000

    // Pre-compute mapped automation arrays
    const filterCutoffAuto = plan.filterAutomation?.map((p) => ({ t: p.t, value: p.cutoff }))
    const filterQAuto = plan.filterAutomation?.map((p) => ({ t: p.t, value: p.q }))
    const fxReverbAuto = plan.fxAutomation?.map((p) => ({ t: p.t, value: p.reverb }))
    const fxDelayAuto = plan.fxAutomation?.map((p) => ({ t: p.t, value: p.delay }))
    const deckAEqLow = plan.deckAEqAutomation?.map((p) => ({ t: p.t, value: p.low }))
    const deckAEqMid = plan.deckAEqAutomation?.map((p) => ({ t: p.t, value: p.mid }))
    const deckAEqHigh = plan.deckAEqAutomation?.map((p) => ({ t: p.t, value: p.high }))
    const deckBEqLow = plan.deckBEqAutomation?.map((p) => ({ t: p.t, value: p.low }))
    const deckBEqMid = plan.deckBEqAutomation?.map((p) => ({ t: p.t, value: p.mid }))
    const deckBEqHigh = plan.deckBEqAutomation?.map((p) => ({ t: p.t, value: p.high }))
    const deckATempoAuto = plan.deckATempoAutomation?.map((p) => ({ t: p.t, value: p.playbackRate }))
    const deckBTempoAuto = plan.deckBTempoAutomation?.map((p) => ({ t: p.t, value: p.playbackRate }))

    // Stem isolation per deck
    const deckAIsoBass = plan.deckAIsolationAutomation?.map((p) => ({ t: p.t, value: p.bass }))
    const deckAIsoVoice = plan.deckAIsolationAutomation?.map((p) => ({ t: p.t, value: p.voice }))
    const deckAIsoMelody = plan.deckAIsolationAutomation?.map((p) => ({ t: p.t, value: p.melody }))
    const deckBIsoBass = plan.deckBIsolationAutomation?.map((p) => ({ t: p.t, value: p.bass }))
    const deckBIsoVoice = plan.deckBIsolationAutomation?.map((p) => ({ t: p.t, value: p.voice }))
    const deckBIsoMelody = plan.deckBIsolationAutomation?.map((p) => ({ t: p.t, value: p.melody }))

    // Flanger from fxAutomation
    const fxFlangerAuto = plan.fxAutomation
      ?.filter((p) => p.flangerMix !== undefined)
      .map((p) => ({ t: p.t, value: p.flangerMix! }))

    // One-shot triggers — track which have fired
    const pendingTriggers = new Set<number>(plan.triggers?.map((_, i) => i) ?? [])

    const initialCrossfader = this.interpolateAutomation(plan.crossfadeAutomation, 0)
    this.setCrossfade(initialCrossfader)

    this.transitionState = {
      isActive: true,
      progress: 0,
      startTime,
      duration: plan.durationSeconds,
      currentValues: {
        crossfader: initialCrossfader,
        filterCutoff: filterCutoffAuto?.length ? this.interpolateAutomation(filterCutoffAuto, 0) : 20000,
        filterQ: filterQAuto?.length ? this.interpolateAutomation(filterQAuto, 0) : 1,
        reverb: fxReverbAuto?.length ? this.interpolateAutomation(fxReverbAuto, 0) : 0,
        delay: fxDelayAuto?.length ? this.interpolateAutomation(fxDelayAuto, 0) : 0,
        flangerMix: fxFlangerAuto?.length ? this.interpolateAutomation(fxFlangerAuto, 0) : 0,
        deckAIsolation: { bass: 0, voice: 0, melody: 0 },
        deckBIsolation: { bass: 0, voice: 0, melody: 0 },
      },
    }
    this.notifyTransitionCallbacks()

    this.transitionInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      const crossfadeValue = this.interpolateAutomation(plan.crossfadeAutomation, progress)
      this.setCrossfade(crossfadeValue)

      // Per-deck EQ
      if (deckAEqLow?.length) {
        const low = this.interpolateAutomation(deckAEqLow, progress)
        const mid = this.interpolateAutomation(deckAEqMid!, progress)
        const high = this.interpolateAutomation(deckAEqHigh!, progress)
        if (this.deckA.eqLow && isFinite(low)) this.deckA.eqLow.gain.value = low
        if (this.deckA.eqMid && isFinite(mid)) this.deckA.eqMid.gain.value = mid
        if (this.deckA.eqHigh && isFinite(high)) this.deckA.eqHigh.gain.value = high
      }
      if (deckBEqLow?.length) {
        const low = this.interpolateAutomation(deckBEqLow, progress)
        const mid = this.interpolateAutomation(deckBEqMid!, progress)
        const high = this.interpolateAutomation(deckBEqHigh!, progress)
        if (this.deckB.eqLow && isFinite(low)) this.deckB.eqLow.gain.value = low
        if (this.deckB.eqMid && isFinite(mid)) this.deckB.eqMid.gain.value = mid
        if (this.deckB.eqHigh && isFinite(high)) this.deckB.eqHigh.gain.value = high
      }

      // Filter
      let filterCutoff = 20000
      let filterQ = 1
      if (filterCutoffAuto?.length) {
        filterCutoff = this.interpolateAutomation(filterCutoffAuto, progress)
        filterQ = this.interpolateAutomation(filterQAuto!, progress)
        if (this.filter && isFinite(filterCutoff)) {
          this.filter.frequency.value = filterCutoff
          if (isFinite(filterQ)) this.filter.Q.value = filterQ
        }
      }

      // FX
      let reverbValue = 0
      let delayValue = 0
      if (fxReverbAuto?.length) {
        reverbValue = this.interpolateAutomation(fxReverbAuto, progress)
        delayValue = this.interpolateAutomation(fxDelayAuto!, progress)
        if (this.reverbGain && isFinite(reverbValue)) this.reverbGain.gain.value = reverbValue
        if (this.delayFeedback && isFinite(delayValue)) this.delayFeedback.gain.value = delayValue * 0.6
        if (this.delayWet && isFinite(delayValue)) this.delayWet.gain.value = delayValue
      }

      // Tempo
      if (deckATempoAuto?.length) {
        const playbackRate = this.interpolateAutomation(deckATempoAuto, progress)
        if (this.activeSources.A && isFinite(playbackRate)) {
          this.activeSources.A.playbackRate.value = playbackRate
        }
      }
      if (deckBTempoAuto?.length) {
        const playbackRate = this.interpolateAutomation(deckBTempoAuto, progress)
        if (this.activeSources.B && isFinite(playbackRate)) {
          this.activeSources.B.playbackRate.value = playbackRate
        }
      }

      // Stem isolation per deck
      let deckAIsoValues = { bass: 0, voice: 0, melody: 0 }
      if (deckAIsoBass?.length) {
        deckAIsoValues = {
          bass: this.interpolateAutomation(deckAIsoBass, progress),
          voice: this.interpolateAutomation(deckAIsoVoice!, progress),
          melody: this.interpolateAutomation(deckAIsoMelody!, progress),
        }
        if (this.deckA.bassIsolateGain && isFinite(deckAIsoValues.bass))
          this.deckA.bassIsolateGain.gain.value = deckAIsoValues.bass
        if (this.deckA.voiceIsolateGain && isFinite(deckAIsoValues.voice))
          this.deckA.voiceIsolateGain.gain.value = deckAIsoValues.voice
        if (this.deckA.melodyIsolateGain && isFinite(deckAIsoValues.melody))
          this.deckA.melodyIsolateGain.gain.value = deckAIsoValues.melody
        const anyIsoA = deckAIsoValues.bass > 0 || deckAIsoValues.voice > 0 || deckAIsoValues.melody > 0
        if (this.deckA.dryPath) this.deckA.dryPath.gain.value = anyIsoA ? 0 : 1
      }
      let deckBIsoValues = { bass: 0, voice: 0, melody: 0 }
      if (deckBIsoBass?.length) {
        deckBIsoValues = {
          bass: this.interpolateAutomation(deckBIsoBass, progress),
          voice: this.interpolateAutomation(deckBIsoVoice!, progress),
          melody: this.interpolateAutomation(deckBIsoMelody!, progress),
        }
        if (this.deckB.bassIsolateGain && isFinite(deckBIsoValues.bass))
          this.deckB.bassIsolateGain.gain.value = deckBIsoValues.bass
        if (this.deckB.voiceIsolateGain && isFinite(deckBIsoValues.voice))
          this.deckB.voiceIsolateGain.gain.value = deckBIsoValues.voice
        if (this.deckB.melodyIsolateGain && isFinite(deckBIsoValues.melody))
          this.deckB.melodyIsolateGain.gain.value = deckBIsoValues.melody
        const anyIsoB = deckBIsoValues.bass > 0 || deckBIsoValues.voice > 0 || deckBIsoValues.melody > 0
        if (this.deckB.dryPath) this.deckB.dryPath.gain.value = anyIsoB ? 0 : 1
      }

      // Flanger
      let flangerMixValue = 0
      if (fxFlangerAuto?.length) {
        flangerMixValue = this.interpolateAutomation(fxFlangerAuto, progress)
        if (this.flangerWet && isFinite(flangerMixValue)) {
          this.flangerWet.gain.value = flangerMixValue
          if (this.flangerDry) this.flangerDry.gain.value = 1 - flangerMixValue * 0.5
        }
      }

      // One-shot triggers (vinyl brake, spinback)
      if (plan.triggers && pendingTriggers.size > 0) {
        for (const i of pendingTriggers) {
          const trigger = plan.triggers[i]
          if (progress >= trigger.t) {
            const targetDeck = trigger.deck as "A" | "B"
            if (trigger.type === "vinylBrake") {
              this.vinylBrake(targetDeck, trigger.duration ?? 1.5)
            } else if (trigger.type === "spinback") {
              this.spinback(targetDeck, trigger.duration ?? 0.8)
            }
            pendingTriggers.delete(i)
          }
        }
      }

      this.musicObject = {
        ...this.musicObject,
        crossfader: crossfadeValue,
        filter: { ...this.musicObject.filter, cutoff: filterCutoff, q: filterQ },
        reverbAmount: reverbValue,
        delayAmount: delayValue,
        fx: { ...this.musicObject.fx, flangerMix: flangerMixValue },
        tracks: {
          A: this.musicObject.tracks.A ? {
            ...this.musicObject.tracks.A,
            bassIsolation: deckAIsoValues.bass,
            voiceIsolation: deckAIsoValues.voice,
            melodyIsolation: deckAIsoValues.melody,
          } : null,
          B: this.musicObject.tracks.B ? {
            ...this.musicObject.tracks.B,
            bassIsolation: deckBIsoValues.bass,
            voiceIsolation: deckBIsoValues.voice,
            melodyIsolation: deckBIsoValues.melody,
          } : null,
        },
        perDeckEq: {
          A: {
            low: deckAEqLow?.length ? this.interpolateAutomation(deckAEqLow, progress) : (this.musicObject.perDeckEq?.A.low ?? 0),
            mid: deckAEqMid?.length ? this.interpolateAutomation(deckAEqMid!, progress) : (this.musicObject.perDeckEq?.A.mid ?? 0),
            high: deckAEqHigh?.length ? this.interpolateAutomation(deckAEqHigh!, progress) : (this.musicObject.perDeckEq?.A.high ?? 0),
          },
          B: {
            low: deckBEqLow?.length ? this.interpolateAutomation(deckBEqLow, progress) : (this.musicObject.perDeckEq?.B.low ?? 0),
            mid: deckBEqMid?.length ? this.interpolateAutomation(deckBEqMid!, progress) : (this.musicObject.perDeckEq?.B.mid ?? 0),
            high: deckBEqHigh?.length ? this.interpolateAutomation(deckBEqHigh!, progress) : (this.musicObject.perDeckEq?.B.high ?? 0),
          },
        },
      }

      this.transitionState = {
        isActive: progress < 1,
        progress,
        startTime,
        duration: plan.durationSeconds,
        currentValues: {
          crossfader: crossfadeValue,
          filterCutoff,
          filterQ,
          reverb: reverbValue,
          delay: delayValue,
          flangerMix: flangerMixValue,
          deckAIsolation: deckAIsoValues,
          deckBIsolation: deckBIsoValues,
        },
      }
      this.notifyTransitionCallbacks()

      if (progress >= 1) {
        clearInterval(this.transitionInterval!)
        this.transitionInterval = null
      }
    }, 50)
  }

  private interpolateAutomation(points: { t: number; value: number }[], progress: number): number {
    if (points.length === 0) return 0
    if (points.length === 1) return points[0].value

    let before = points[0]
    let after = points[points.length - 1]

    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].t <= progress && points[i + 1].t >= progress) {
        before = points[i]
        after = points[i + 1]
        break
      }
    }

    if (before.t === after.t) return before.value

    const ratio = (progress - before.t) / (after.t - before.t)
    // Smooth cubic interpolation (ease-in-out) instead of linear
    const smooth = ratio * ratio * (3 - 2 * ratio)
    return before.value + (after.value - before.value) * smooth
  }

  // --- Analyser Data (pre-allocated buffers) ---
  getAnalyserData(): { frequency: Uint8Array; timeDomain: Uint8Array } {
    if (!this.analyser || !this.analyserFreqBuffer || !this.analyserTimeBuffer) {
      return {
        frequency: new Uint8Array(1024),
        timeDomain: new Uint8Array(1024),
      }
    }

    this.analyser.getByteFrequencyData(this.analyserFreqBuffer)
    this.analyser.getByteTimeDomainData(this.analyserTimeBuffer)

    return { frequency: this.analyserFreqBuffer, timeDomain: this.analyserTimeBuffer }
  }

  getCurrentTime(deck: "A" | "B"): number {
    if (!this.audioContext) return 0
    const d = deck === "A" ? this.deckA : this.deckB
    if (d.isPlaying) {
      return this.audioContext.currentTime - d.startTime
    }
    return d.pauseTime
  }

  getDuration(deck: "A" | "B"): number {
    return (deck === "A" ? this.deckA : this.deckB).buffer?.duration || 0
  }

  isPlaying(deck: "A" | "B"): boolean {
    return (deck === "A" ? this.deckA : this.deckB).isPlaying
  }

  hasTrack(deck: "A" | "B"): boolean {
    return (deck === "A" ? this.deckA : this.deckB).buffer !== null
  }

  getMusicObject(): MusicObject {
    return this.musicObject
  }

  seek(deck: "A" | "B", time: number): void {
    const d = deck === "A" ? this.deckA : this.deckB
    const wasPlaying = d.isPlaying

    if (wasPlaying) this.pause(deck)

    d.pauseTime = Math.max(0, Math.min(time, d.buffer?.duration || 0))

    if (wasPlaying) this.play(deck)
  }

  dispose(): void {
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval)
      this.transitionInterval = null
    }

    this.transitionCallbacks.clear()
    this.clearLoopTimeout("A")
    this.clearLoopTimeout("B")
    this.stopDeck("A")
    this.stopDeck("B")

    if (this.flangerLFO) {
      try { this.flangerLFO.stop() } catch { /* already stopped */ }
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

// Singleton instance
let engineInstance: MusicEngine | null = null

export function getMusicEngine(): MusicEngine {
  if (!engineInstance) {
    engineInstance = new MusicEngine()
  }
  return engineInstance
}
