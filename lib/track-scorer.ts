import type { Track } from "./types"
import { getCamelotCompatibility } from "./types"

/** Weights for the scoring formula */
const WEIGHTS = {
  harmonic: 0.40,
  bpm: 0.25,
  energy: 0.20,
  genre: 0.10,
  recency: 0.05,
}

export interface ScoredTrack {
  track: Track
  score: number
  breakdown: {
    harmonic: number
    bpm: number
    energy: number
    genre: number
    recency: number
  }
  camelotCompat: number | null
  bpmDiff: number | null
  mixNote: string
}

/**
 * Deterministically score and rank library tracks against a reference track.
 * Returns tracks sorted by compatibility score (highest first).
 *
 * This runs client-side before LLM calls so we only send the top N candidates,
 * dramatically reducing token usage and improving recommendation quality.
 */
export function scoreLibrary(
  currentTrack: Track,
  library: Track[],
  opts?: {
    targetEnergy?: number // override energy target (for energy arc)
    excludeIds?: string[] // already played track IDs
    maxResults?: number
  },
): ScoredTrack[] {
  const available = library.filter(
    (t) => t.id !== currentTrack.id && !(opts?.excludeIds ?? []).includes(t.id),
  )

  const scored = available.map((track) => scoreTrack(currentTrack, track, opts?.targetEnergy))

  scored.sort((a, b) => b.score - a.score)

  return opts?.maxResults ? scored.slice(0, opts.maxResults) : scored
}

function scoreTrack(
  ref: Track,
  candidate: Track,
  targetEnergy?: number,
): ScoredTrack {
  const harmonic = scoreHarmonic(ref, candidate)
  const bpm = scoreBPM(ref, candidate)
  const energy = scoreEnergy(ref, candidate, targetEnergy)
  const genre = scoreGenre(ref, candidate)
  const recency = scoreRecency(candidate)

  const score =
    harmonic * WEIGHTS.harmonic +
    bpm * WEIGHTS.bpm +
    energy * WEIGHTS.energy +
    genre * WEIGHTS.genre +
    recency * WEIGHTS.recency

  const camelotA = ref.camelotKey ?? null
  const camelotB = candidate.camelotKey ?? null
  const camelotCompat = camelotA && camelotB ? getCamelotCompatibility(camelotA, camelotB) : null

  const bpmDiff = ref.bpm && candidate.bpm ? Math.abs(ref.bpm - candidate.bpm) : null

  return {
    track: candidate,
    score,
    breakdown: { harmonic, bpm, energy, genre, recency },
    camelotCompat,
    bpmDiff,
    mixNote: generateMixNote(ref, candidate, { harmonic, bpm, energy, camelotCompat, bpmDiff }),
  }
}

/** Harmonic compatibility via Camelot wheel */
function scoreHarmonic(ref: Track, candidate: Track): number {
  const a = ref.camelotKey
  const b = candidate.camelotKey
  if (!a || !b) return 0.5 // unknown keys get neutral score
  return getCamelotCompatibility(a, b)
}

/** BPM proximity — tracks within 3 BPM are ideal, >10 BPM diff is poor */
function scoreBPM(ref: Track, candidate: Track): number {
  const a = ref.bpm
  const b = candidate.bpm
  if (!a || !b) return 0.5

  const diff = Math.abs(a - b)

  // Check for half/double time compatibility
  const halfDiff = Math.abs(a - b * 2)
  const doubleDiff = Math.abs(a - b / 2)
  const effectiveDiff = Math.min(diff, halfDiff, doubleDiff)

  if (effectiveDiff <= 1) return 1
  if (effectiveDiff <= 3) return 0.95
  if (effectiveDiff <= 5) return 0.85
  if (effectiveDiff <= 8) return 0.7
  if (effectiveDiff <= 12) return 0.5
  return Math.max(0, 1 - effectiveDiff * 0.04)
}

/** Energy compatibility — prefer smooth progression, not jarring jumps */
function scoreEnergy(ref: Track, candidate: Track, targetEnergy?: number): number {
  const refE = ref.energy ?? 0.5
  const candE = candidate.energy ?? 0.5
  const target = targetEnergy ?? refE

  const diff = Math.abs(target - candE)
  // Allow small energy shifts (±0.15 is ideal for flow)
  if (diff <= 0.1) return 1
  if (diff <= 0.2) return 0.9
  if (diff <= 0.3) return 0.7
  return Math.max(0, 1 - diff)
}

/** Genre similarity — simple keyword matching */
function scoreGenre(ref: Track, candidate: Track): number {
  const a = ref.genre?.toLowerCase()
  const b = candidate.genre?.toLowerCase()
  if (!a || !b) return 0.5

  if (a === b) return 1

  // Partial match (e.g., "deep house" contains "house")
  const aWords = a.split(/\s+/)
  const bWords = b.split(/\s+/)
  const shared = aWords.filter((w) => bWords.includes(w)).length
  const total = Math.max(aWords.length, bWords.length)
  if (shared > 0) return 0.5 + (shared / total) * 0.5

  // Genre family groupings
  const families: string[][] = [
    ["house", "deep house", "tech house", "progressive house", "electro house"],
    ["techno", "minimal techno", "industrial techno", "acid techno"],
    ["trance", "progressive trance", "uplifting trance", "psytrance"],
    ["drum and bass", "dnb", "jungle", "liquid dnb"],
    ["dubstep", "riddim", "brostep"],
    ["hip hop", "hip-hop", "rap", "trap"],
    ["pop", "synth pop", "electropop", "indie pop"],
    ["r&b", "rnb", "soul", "neo-soul"],
  ]

  for (const family of families) {
    const aMatch = family.some((g) => a.includes(g))
    const bMatch = family.some((g) => b.includes(g))
    if (aMatch && bMatch) return 0.7
  }

  return 0.3
}

/** Recency — slightly prefer newer tracks for freshness */
function scoreRecency(candidate: Track): number {
  if (!candidate.createdAt) return 0.5
  const age = Date.now() - new Date(candidate.createdAt).getTime()
  const days = age / (1000 * 60 * 60 * 24)
  if (days < 1) return 1
  if (days < 7) return 0.9
  if (days < 30) return 0.7
  return 0.5
}

/** Generate a human-readable mixing note */
function generateMixNote(
  ref: Track,
  candidate: Track,
  scores: { harmonic: number; bpm: number; energy: number; camelotCompat: number | null; bpmDiff: number | null },
): string {
  const parts: string[] = []

  if (scores.camelotCompat !== null) {
    if (scores.camelotCompat >= 0.9) parts.push("perfect harmonic match")
    else if (scores.camelotCompat >= 0.7) parts.push("good harmonic fit")
    else if (scores.camelotCompat < 0.5) parts.push("key clash — use filter sweep")
  }

  if (scores.bpmDiff !== null) {
    if (scores.bpmDiff <= 3) parts.push("BPMs aligned")
    else if (scores.bpmDiff <= 8) parts.push(`${scores.bpmDiff.toFixed(0)} BPM gap — sync gradually`)
    else parts.push(`large BPM gap (${scores.bpmDiff.toFixed(0)}) — use cut or energy drop`)
  }

  const refE = ref.energy ?? 0.5
  const candE = candidate.energy ?? 0.5
  if (candE > refE + 0.2) parts.push("energy boost")
  else if (candE < refE - 0.2) parts.push("energy dip")

  return parts.join(", ") || "neutral mix"
}
