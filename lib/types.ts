// Core data types for the DJ system

export interface Track {
  id: string
  title: string
  artist: string
  genre?: string
  bpm?: number
  key?: string
  camelotKey?: string
  mood?: string
  energy?: number
  tags?: string[]
  description?: string
  url: string
  duration?: number
  waveformData?: number[]
  waveformPeaks?: WaveformPeak[]
  createdAt: Date
  analyzed: boolean
}

export interface WaveformPeak {
  max: number
  min: number
  rms: number
  bassEnergy: number
  midEnergy: number
  highEnergy: number
}

export interface CuePoint {
  id: string
  time: number
  label: string
  color: string
}

export interface LoopRegion {
  startTime: number
  endTime: number
  active: boolean
}

export interface TrackSettings {
  id: string
  url: string
  title: string
  artist: string
  gain: number
  pan: number
  playbackRate: number
  enabled: boolean
  bassIsolation?: number
  voiceIsolation?: number
  melodyIsolation?: number
  cuePoints?: CuePoint[]
  loop?: LoopRegion | null
}

export interface EQSettings {
  low: number
  mid: number
  high: number
}

export interface FilterSettings {
  type: "lowpass" | "highpass" | "bandpass"
  cutoff: number
  q: number
}

export interface FXSettings {
  flangerRate: number
  flangerDepth: number
  flangerMix: number
  phaserRate: number
  phaserDepth: number
  phaserMix: number
}

export interface MusicObject {
  tempo: number
  key: string
  energy: number
  masterGain: number
  crossfader: number

  tracks: {
    A: TrackSettings | null
    B: TrackSettings | null
  }

  reverbAmount: number
  delayAmount: number
  delayFeedback: number

  eq: EQSettings
  perDeckEq?: {
    A: EQSettings
    B: EQSettings
  }

  filter: FilterSettings
  fx: FXSettings

  visualizerMode: "cymatic" | "tunnel" | "waveform" | "spectrum" | "grok"
  visualSensitivity: number
  colorScheme: "cyberpunk" | "neon" | "monochrome" | "fire" | "aurora" | "sunset" | "ocean"
}

export interface TransitionPlan {
  startDelay?: number
  durationSeconds: number
  technique?: "bass_swap" | "eq_blend" | "filter_sweep" | "echo_out" | "quick_cut" | "long_blend" | "energy_drop" | "build_up"
  phaseAlignment?: "phrase_start" | "drop" | "breakdown" | "buildup" | "outro"
  crossfadeAutomation: { t: number; value: number }[]
  deckAEqAutomation?: { t: number; low: number; mid: number; high: number }[]
  deckBEqAutomation?: { t: number; low: number; mid: number; high: number }[]
  deckATempoAutomation?: { t: number; playbackRate: number }[]
  deckBTempoAutomation?: { t: number; playbackRate: number }[]
  filterAutomation?: { t: number; cutoff: number; q: number }[]
  fxAutomation?: { t: number; reverb: number; delay: number; flangerMix?: number }[]
  // Stem isolation automation per deck (0=stem muted, 1=stem full)
  deckAIsolationAutomation?: { t: number; bass: number; voice: number; melody: number }[]
  deckBIsolationAutomation?: { t: number; bass: number; voice: number; melody: number }[]
  // One-shot effects fired at specific transition points
  triggers?: { t: number; type: "vinylBrake" | "spinback"; deck: "outgoing" | "incoming" | "A" | "B"; duration?: number }[]
  incomingStartSeconds?: number
  visualizerConfig?: Partial<MusicObject>
  explanation?: string
}

export interface TrackAnalysis {
  genre: string
  mood: string
  energy: number
  bpm: number
  key: string
  description: string
  tags: string[]
}

export interface Preset {
  id: string
  name: string
  description: string
  musicObject: Partial<MusicObject>
  createdAt: Date
}

export interface DJCoachMessage {
  id: string
  message: string
  type: "info" | "tip" | "action" | "analysis"
  timestamp: Date
}

export interface TrackRecommendation {
  trackId: string
  reason: string
  compatibilityScore: number
  suggestedTransition?: string
}

export const defaultFXSettings: FXSettings = {
  flangerRate: 0.25,
  flangerDepth: 0.002,
  flangerMix: 0,
  phaserRate: 0.5,
  phaserDepth: 0.5,
  phaserMix: 0,
}

export const defaultMusicObject: MusicObject = {
  tempo: 120,
  key: "C",
  energy: 0.5,
  masterGain: 0.8,
  crossfader: 0,

  tracks: {
    A: null,
    B: null,
  },

  reverbAmount: 0,
  delayAmount: 0,
  delayFeedback: 0.3,

  eq: {
    low: 0,
    mid: 0,
    high: 0,
  },

  filter: {
    type: "lowpass",
    cutoff: 20000,
    q: 1,
  },

  fx: { ...defaultFXSettings },

  visualizerMode: "cymatic",
  visualSensitivity: 0.7,
  colorScheme: "aurora",
}

// Camelot wheel for harmonic mixing compatibility
export const CAMELOT_WHEEL: Record<string, { key: string; mode: "major" | "minor"; number: number; letter: string }> = {
  "1A": { key: "Ab minor", mode: "minor", number: 1, letter: "A" },
  "1B": { key: "B major", mode: "major", number: 1, letter: "B" },
  "2A": { key: "Eb minor", mode: "minor", number: 2, letter: "A" },
  "2B": { key: "F# major", mode: "major", number: 2, letter: "B" },
  "3A": { key: "Bb minor", mode: "minor", number: 3, letter: "A" },
  "3B": { key: "Db major", mode: "major", number: 3, letter: "B" },
  "4A": { key: "F minor", mode: "minor", number: 4, letter: "A" },
  "4B": { key: "Ab major", mode: "major", number: 4, letter: "B" },
  "5A": { key: "C minor", mode: "minor", number: 5, letter: "A" },
  "5B": { key: "Eb major", mode: "major", number: 5, letter: "B" },
  "6A": { key: "G minor", mode: "minor", number: 6, letter: "A" },
  "6B": { key: "Bb major", mode: "major", number: 6, letter: "B" },
  "7A": { key: "D minor", mode: "minor", number: 7, letter: "A" },
  "7B": { key: "F major", mode: "major", number: 7, letter: "B" },
  "8A": { key: "A minor", mode: "minor", number: 8, letter: "A" },
  "8B": { key: "C major", mode: "major", number: 8, letter: "B" },
  "9A": { key: "E minor", mode: "minor", number: 9, letter: "A" },
  "9B": { key: "G major", mode: "major", number: 9, letter: "B" },
  "10A": { key: "B minor", mode: "minor", number: 10, letter: "A" },
  "10B": { key: "D major", mode: "major", number: 10, letter: "B" },
  "11A": { key: "F# minor", mode: "minor", number: 11, letter: "A" },
  "11B": { key: "A major", mode: "major", number: 11, letter: "B" },
  "12A": { key: "Db minor", mode: "minor", number: 12, letter: "A" },
  "12B": { key: "E major", mode: "major", number: 12, letter: "B" },
}

export function getCamelotCompatibility(keyA: string, keyB: string): number {
  const a = CAMELOT_WHEEL[keyA]
  const b = CAMELOT_WHEEL[keyB]
  if (!a || !b) return 0

  // Same key = perfect
  if (keyA === keyB) return 1

  // Adjacent on wheel (±1) with same letter = great
  const numDiff = Math.abs(a.number - b.number)
  const circDiff = Math.min(numDiff, 12 - numDiff)

  if (circDiff <= 1 && a.letter === b.letter) return 0.9
  // Same number, different letter (relative major/minor) = great
  if (a.number === b.number && a.letter !== b.letter) return 0.85
  // ±1 different letter
  if (circDiff <= 1) return 0.7
  // ±2 same letter
  if (circDiff === 2 && a.letter === b.letter) return 0.5

  return Math.max(0, 1 - circDiff * 0.15)
}
