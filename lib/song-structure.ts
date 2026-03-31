// Song structure analysis — detects sections, phrase boundaries, and optimal transition points
// Uses waveform energy + BPM to identify intro/verse/buildup/drop/breakdown/outro

import type { WaveformPeak } from "./types"

export interface SongSection {
  type: "intro" | "verse" | "buildup" | "drop" | "breakdown" | "bridge" | "outro"
  startTime: number
  endTime: number
  energy: number      // average normalized energy 0-1
  peakEnergy: number  // peak normalized energy 0-1
}

export interface PhraseBoundary {
  time: number
  strength: number // 0-1, magnitude of energy change at this boundary
}

export interface SongStructure {
  sections: SongSection[]
  phraseBoundaries: PhraseBoundary[]
  phraseLengthSeconds: number
  barLengthSeconds: number
  firstDropTime: number | null
  outroStartTime: number | null
  bestEntryPoint: number          // seconds — best place to start incoming track
  bestExitRegions: { time: number; reason: string }[]
}

export function analyzeSongStructure(
  peaks: WaveformPeak[],
  duration: number,
  bpm: number | null,
): SongStructure {
  const effectiveBpm = bpm ?? 120
  const beatLength = 60 / effectiveBpm
  const barLength = beatLength * 4
  const phraseLength = barLength * 8 // 8-bar phrases — standard in dance/pop/electronic

  const peaksPerSecond = peaks.length / duration
  const peaksPerPhrase = Math.max(1, Math.round(phraseLength * peaksPerSecond))
  const peaksPerBar = Math.max(1, Math.round(barLength * peaksPerSecond))

  // Step 1: Smoothed energy curve from RMS values
  const rawEnergy = peaks.map(p => p.rms)
  const smoothWindow = Math.max(3, Math.round(peaksPerBar / 2))
  const smoothed = movingAverage(rawEnergy, smoothWindow)

  const maxE = Math.max(...smoothed, 0.001)
  const normalized = smoothed.map(v => v / maxE)

  // Step 2: Phrase boundaries with energy-change scoring
  const phraseBoundaries: PhraseBoundary[] = []
  for (let i = 0; i < peaks.length; i += peaksPerPhrase) {
    const time = (i / peaks.length) * duration
    const before = avgRange(normalized, Math.max(0, i - peaksPerPhrase), i)
    const after = avgRange(normalized, i, Math.min(normalized.length, i + peaksPerPhrase))
    phraseBoundaries.push({ time, strength: Math.min(1, Math.abs(after - before) * 3) })
  }

  // Step 3: Per-phrase energy stats
  const numPhrases = Math.ceil(peaks.length / peaksPerPhrase)
  const phraseStats: { mean: number; peak: number; trend: number }[] = []
  for (let p = 0; p < numPhrases; p++) {
    const start = p * peaksPerPhrase
    const end = Math.min((p + 1) * peaksPerPhrase, normalized.length)
    const slice = normalized.slice(start, end)
    if (slice.length === 0) continue
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    const peak = Math.max(...slice)
    const mid = Math.floor(slice.length / 2) || 1
    const firstHalf = slice.slice(0, mid).reduce((a, b) => a + b, 0) / mid
    const secondHalf = slice.slice(mid).reduce((a, b) => a + b, 0) / (slice.length - mid || 1)
    phraseStats.push({ mean, peak, trend: secondHalf - firstHalf })
  }

  // Step 4: Classify each phrase into section types
  const overallMean = phraseStats.reduce((a, p) => a + p.mean, 0) / (phraseStats.length || 1)
  const highThreshold = overallMean + (1 - overallMean) * 0.3
  const lowThreshold = overallMean * 0.55

  const phraseTypes: SongSection["type"][] = phraseStats.map((s, i) => {
    const isFirst = i <= 1
    const isLast = i >= phraseStats.length - 2
    const prev = i > 0 ? phraseStats[i - 1].mean : 0
    const next = i < phraseStats.length - 1 ? phraseStats[i + 1].mean : 0

    // Intro: first phrases with low energy
    if (isFirst && s.mean < lowThreshold) return "intro"
    // Outro: last phrases with declining/low energy
    if (isLast && (s.mean < prev * 0.8 || s.mean < lowThreshold)) return "outro"
    // Breakdown: sudden energy dip after high energy
    if (s.mean < lowThreshold && prev >= highThreshold * 0.8) return "breakdown"
    // Buildup: rising energy heading into high energy
    if (s.trend > 0.1 && s.mean < highThreshold && next >= highThreshold * 0.8) return "buildup"
    // Drop: high energy, especially following lower energy
    if (s.mean >= highThreshold) return "drop"
    // Buildup: rising trend even without confirmed drop ahead
    if (s.trend > 0.15 && s.mean > lowThreshold) return "buildup"
    // Low energy mid-song
    if (s.mean < lowThreshold) return "breakdown"
    // Default
    return "verse"
  })

  // Step 5: Merge consecutive same-type phrases into sections
  const sections: SongSection[] = []
  let currentType = phraseTypes[0] ?? "verse"
  let currentStart = 0

  for (let i = 1; i <= phraseStats.length; i++) {
    const type = i < phraseStats.length ? phraseTypes[i] : null
    if (type !== currentType || i === phraseStats.length) {
      const startIdx = currentStart * peaksPerPhrase
      const endIdx = Math.min(i * peaksPerPhrase, normalized.length)
      const sectionPeaks = normalized.slice(startIdx, endIdx)
      if (sectionPeaks.length > 0) {
        sections.push({
          type: currentType,
          startTime: (startIdx / peaks.length) * duration,
          endTime: (endIdx / peaks.length) * duration,
          energy: sectionPeaks.reduce((a, b) => a + b, 0) / sectionPeaks.length,
          peakEnergy: Math.max(...sectionPeaks),
        })
      }
      if (type) {
        currentType = type
        currentStart = i
      }
    }
  }

  // Step 6: Identify key points
  const firstDrop = sections.find(s => s.type === "drop")
  const outroSection = [...sections].reverse().find(s => s.type === "outro")

  // Best entry: skip intro, enter at first non-intro section
  const introSection = sections.find(s => s.type === "intro")
  const firstNonIntro = sections.find(s => s.type !== "intro")
  const bestEntry = introSection && introSection.endTime > phraseLength * 2
    ? firstNonIntro?.startTime ?? introSection.endTime
    : 0 // short/no intro — start from beginning

  // Best exit regions: breakdowns, outro starts, post-drop phrase boundaries
  const exitRegions: { time: number; reason: string }[] = []
  for (const section of sections) {
    if (section.type === "breakdown") {
      exitRegions.push({
        time: section.startTime,
        reason: `breakdown at ${fmtTime(section.startTime)} — energy dip is ideal for blending`,
      })
    }
    if (section.type === "outro") {
      exitRegions.push({
        time: section.startTime,
        reason: `outro at ${fmtTime(section.startTime)} — natural exit point`,
      })
    }
  }
  for (const section of sections) {
    if (section.type === "drop") {
      const boundary = phraseBoundaries.find(b => b.time >= section.endTime - 2)
      if (boundary) {
        exitRegions.push({
          time: boundary.time,
          reason: `post-drop at ${fmtTime(boundary.time)} — energy resolved, good handoff`,
        })
      }
    }
  }

  return {
    sections,
    phraseBoundaries,
    phraseLengthSeconds: phraseLength,
    barLengthSeconds: barLength,
    firstDropTime: firstDrop?.startTime ?? null,
    outroStartTime: outroSection?.startTime ?? null,
    bestEntryPoint: bestEntry,
    bestExitRegions: exitRegions.sort((a, b) => a.time - b.time),
  }
}

/** Find the next optimal transition-out point from the current playback position */
export function findNextExitPoint(
  structure: SongStructure,
  currentTime: number,
): { time: number; delay: number; reason: string } {
  // Look for structural exit regions after current position
  const upcoming = structure.bestExitRegions.filter(e => e.time > currentTime + 2)
  if (upcoming.length > 0) {
    // Pick nearest, cap delay at 30s — user expects action soon
    const best = upcoming.find(e => e.time - currentTime <= 30) ?? upcoming[0]
    return { time: best.time, delay: Math.min(30, best.time - currentTime), reason: best.reason }
  }

  // Fall back to nearest phrase boundary
  const nextPhrase = structure.phraseBoundaries.find(b => b.time > currentTime + 2)
  if (nextPhrase) {
    return {
      time: nextPhrase.time,
      delay: Math.min(30, nextPhrase.time - currentTime),
      reason: `next phrase boundary at ${fmtTime(nextPhrase.time)}`,
    }
  }

  return { time: currentTime, delay: 0, reason: "no upcoming boundaries — starting immediately" }
}

/** Find the best entry point for the incoming song */
export function findBestEntryPoint(
  structure: SongStructure,
): { time: number; reason: string } {
  if (structure.bestEntryPoint <= 0) {
    return { time: 0, reason: "short or no intro — starting from beginning" }
  }
  return {
    time: structure.bestEntryPoint,
    reason: `skipping intro — entering at ${fmtTime(structure.bestEntryPoint)}`,
  }
}

/** Serialize structure to a compact text summary for the AI prompt */
export function structureToPromptText(
  structure: SongStructure,
  label: string,
  currentTime?: number,
  duration?: number,
): string {
  const lines: string[] = []
  lines.push(`${label} Song Structure (analyzed from audio):`)
  lines.push(`  Phrase length: ${structure.phraseLengthSeconds.toFixed(1)}s (8 bars), Bar: ${structure.barLengthSeconds.toFixed(1)}s`)

  lines.push("  Sections:")
  for (const s of structure.sections) {
    const marker = currentTime !== undefined && currentTime >= s.startTime && currentTime < s.endTime ? " ◀ NOW" : ""
    lines.push(`    ${s.type.toUpperCase().padEnd(10)} ${fmtTime(s.startTime)}–${fmtTime(s.endTime)}  energy=${(s.energy * 100).toFixed(0)}%${marker}`)
  }

  if (currentTime !== undefined) {
    const currentSection = structure.sections.find(s => currentTime >= s.startTime && currentTime < s.endTime)
    if (currentSection) {
      lines.push(`  Currently in: ${currentSection.type} (${(currentSection.energy * 100).toFixed(0)}% energy)`)
      const timeLeft = currentSection.endTime - currentTime
      lines.push(`  Time until section ends: ${timeLeft.toFixed(0)}s`)
    }
  }

  if (structure.firstDropTime !== null) {
    lines.push(`  First drop: ${fmtTime(structure.firstDropTime)}`)
  }
  if (structure.outroStartTime !== null) {
    lines.push(`  Outro starts: ${fmtTime(structure.outroStartTime)}`)
  }

  if (structure.bestExitRegions.length > 0) {
    lines.push("  Best exit points:")
    for (const e of structure.bestExitRegions.slice(0, 4)) {
      const upcoming = currentTime !== undefined && e.time > currentTime ? ` (in ${(e.time - currentTime).toFixed(0)}s)` : ""
      lines.push(`    ${fmtTime(e.time)} — ${e.reason}${upcoming}`)
    }
  }

  lines.push(`  Best entry point: ${fmtTime(structure.bestEntryPoint)}`)

  return lines.join("\n")
}

// --- Helpers ---

function movingAverage(data: number[], window: number): number[] {
  const result: number[] = []
  const half = Math.floor(window / 2)
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half)
    const end = Math.min(data.length, i + half + 1)
    let sum = 0
    for (let j = start; j < end; j++) sum += data[j]
    result.push(sum / (end - start))
  }
  return result
}

function avgRange(data: number[], start: number, end: number): number {
  const s = Math.max(0, Math.floor(start))
  const e = Math.min(data.length, Math.floor(end))
  if (e <= s) return 0
  let sum = 0
  for (let i = s; i < e; i++) sum += data[i]
  return sum / (e - s)
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}
