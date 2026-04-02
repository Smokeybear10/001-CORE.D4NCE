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

/** Find the next optimal transition-out point from the current playback position.
 *  Considers what section we're in and what's coming up to pick the most musical moment. */
export function findNextExitPoint(
  structure: SongStructure,
  currentTime: number,
  duration?: number,
): { time: number; delay: number; reason: string } {
  const currentSection = structure.sections.find(
    s => currentTime >= s.startTime && currentTime < s.endTime,
  )
  const remaining = duration ? duration - currentTime : Infinity

  // If we're in a breakdown or outro, go NOW — this is the natural exit
  if (currentSection?.type === "breakdown" || currentSection?.type === "outro") {
    return { time: currentTime, delay: 0, reason: `already in ${currentSection.type} — transition now` }
  }

  // If we're in a buildup, NEVER cut it — wait for the drop to resolve
  if (currentSection?.type === "buildup") {
    const dropAfter = structure.sections.find(
      s => s.type === "drop" && s.startTime >= currentSection.endTime - 1,
    )
    if (dropAfter) {
      // Wait for the drop to finish, then exit at the post-drop boundary
      const exitTime = dropAfter.endTime
      const delay = Math.min(45, exitTime - currentTime)
      return { time: exitTime, delay, reason: `in buildup — waiting for drop to resolve at ${fmtTime(exitTime)}` }
    }
    // No drop found — wait for buildup to end
    const delay = Math.min(30, currentSection.endTime - currentTime)
    return { time: currentSection.endTime, delay, reason: `in buildup — waiting for it to end at ${fmtTime(currentSection.endTime)}` }
  }

  // If we're in a drop, wait for the end of the drop or next breakdown
  if (currentSection?.type === "drop") {
    const nextBreak = structure.sections.find(
      s => (s.type === "breakdown" || s.type === "outro" || s.type === "verse") && s.startTime > currentTime,
    )
    if (nextBreak && nextBreak.startTime - currentTime < 40) {
      return {
        time: nextBreak.startTime,
        delay: nextBreak.startTime - currentTime,
        reason: `in drop — exiting at ${nextBreak.type} (${fmtTime(nextBreak.startTime)})`,
      }
    }
    // Drop is long or nothing after — find phrase boundary within the drop
    const phraseBound = structure.phraseBoundaries.find(b => b.time > currentTime + 4)
    if (phraseBound && phraseBound.time < currentSection.endTime) {
      return {
        time: phraseBound.time,
        delay: phraseBound.time - currentTime,
        reason: `in drop — exiting at phrase boundary ${fmtTime(phraseBound.time)}`,
      }
    }
  }

  // Urgent: <30s left — find the nearest phrase boundary and go
  if (remaining < 30) {
    const nextPhrase = structure.phraseBoundaries.find(b => b.time > currentTime + 1)
    if (nextPhrase && nextPhrase.time < currentTime + remaining - 5) {
      return {
        time: nextPhrase.time,
        delay: nextPhrase.time - currentTime,
        reason: `<30s remaining — exiting at phrase boundary ${fmtTime(nextPhrase.time)}`,
      }
    }
    return { time: currentTime, delay: 0, reason: "running out of time — transition now" }
  }

  // Default: look for structural exit regions
  const upcoming = structure.bestExitRegions.filter(e => e.time > currentTime + 2)
  if (upcoming.length > 0) {
    const best = upcoming.find(e => e.time - currentTime <= 30) ?? upcoming[0]
    return { time: best.time, delay: Math.min(30, best.time - currentTime), reason: best.reason }
  }

  // Last resort: nearest phrase boundary
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

/** Find the best entry point for the incoming song.
 *  Goal: cue before the first buildup or energy rise so the transition
 *  leads into the incoming track's high-energy section.
 *  @param transitionDuration expected blend duration (used to back up the cue so the
 *    blend completes right as the energy arrives) */
export function findBestEntryPoint(
  structure: SongStructure,
  transitionDuration = 16,
): { time: number; reason: string; targetMoment?: string } {
  const { sections, phraseLengthSeconds } = structure

  // Find the first buildup — ideal: cue so the blend ends as the buildup peaks
  const firstBuildup = sections.find(s => s.type === "buildup")
  if (firstBuildup) {
    // We want the incoming track audible during the buildup.
    // Cue 1 phrase before the buildup so low-energy audio plays silently at first,
    // then the buildup rises as the crossfader opens.
    const cue = Math.max(0, firstBuildup.startTime - phraseLengthSeconds)
    return {
      time: cue,
      reason: `entering 1 phrase before buildup — buildup starts at ${fmtTime(firstBuildup.startTime)}, blend catches the energy rise`,
      targetMoment: `buildup at ${fmtTime(firstBuildup.startTime)}`,
    }
  }

  // No buildup — find first drop and cue before it
  const firstDrop = sections.find(s => s.type === "drop")
  if (firstDrop) {
    const cue = Math.max(0, firstDrop.startTime - phraseLengthSeconds * 2)
    return {
      time: cue,
      reason: `no buildup detected — entering 2 phrases before first drop at ${fmtTime(firstDrop.startTime)}`,
      targetMoment: `drop at ${fmtTime(firstDrop.startTime)}`,
    }
  }

  // No buildup or drop — find the first high-energy section
  const highEnergy = sections.find(s => s.energy > 0.6 && s.type !== "intro")
  if (highEnergy) {
    const cue = Math.max(0, highEnergy.startTime - phraseLengthSeconds)
    return {
      time: cue,
      reason: `entering before high-energy section at ${fmtTime(highEnergy.startTime)}`,
      targetMoment: `high energy at ${fmtTime(highEnergy.startTime)}`,
    }
  }

  // Fallback: skip intro if long
  if (structure.bestEntryPoint > 0) {
    return {
      time: structure.bestEntryPoint,
      reason: `skipping intro — entering at ${fmtTime(structure.bestEntryPoint)}`,
    }
  }

  return { time: 0, reason: "short or no intro — starting from beginning" }
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

  const entry = findBestEntryPoint(structure)
  lines.push(`  Best entry point: ${fmtTime(entry.time)}${entry.targetMoment ? ` (target: ${entry.targetMoment})` : ""}`)

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
