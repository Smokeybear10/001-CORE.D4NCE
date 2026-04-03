// Deterministic transition plan builder — uses hardcoded per-song metadata
// instead of AI. Based on professional DJ mixing: bass swap, EQ blending,
// filter sweeps, echo outs. Song-aware: knows section timestamps, BPMs, and
// which tracks pair well together.

import type { Track, TransitionPlan } from "./types"
import type { SongStructure } from "./song-structure"
import { getTrackBpm, getTrackMeta, getNextBlendZone, getCurrentSection } from "./track-metadata"

/**
 * Build a transition plan from track metadata and song structure.
 * Picks technique based on BPM compatibility:
 *   - Within 15%: EQ blend with bass swap (16 bars)
 *   - 15-30%: Filter sweep (8 bars)
 *   - >30%: Echo out / quick cut (4 bars)
 *
 * Assumes outgoing = deck A, incoming = deck B (handleApplyTransition swaps if needed).
 */
export function buildTransitionPlan(
  outgoing: Track,
  incoming: Track,
  _outgoingStructure: SongStructure | null,
  _incomingStructure: SongStructure | null,
): TransitionPlan {
  const outBpm = getTrackBpm(outgoing)
  const inBpm = getTrackBpm(incoming)
  const bpmRatio = Math.abs(outBpm - inBpm) / Math.max(outBpm, inBpm)

  const inMeta = getTrackMeta(incoming)
  const outMeta = getTrackMeta(outgoing)

  // Pick incoming cue point from song metadata
  const incomingStart = inMeta?.mixIn ?? 0

  // Pick technique based on BPM compatibility
  let plan: TransitionPlan
  if (bpmRatio < 0.15) {
    plan = buildEqBlendPlan(outBpm, inBpm, outgoing, incoming, outMeta !== null)
  } else if (bpmRatio < 0.30) {
    plan = buildFilterSweepPlan(outBpm, inBpm, outgoing, incoming)
  } else {
    plan = buildEchoOutPlan(outBpm, outgoing, incoming)
  }

  plan.incomingStartSeconds = incomingStart
  return plan
}

// ─── EQ Blend with Bass Swap ─────────────────────────────────────────────────
// The gold standard: highs first → mids → bass swap on phrase boundary → fade out.
// Used when BPMs are within 15% (e.g., Starships 125 → Die Young 128).
function buildEqBlendPlan(
  outBpm: number, inBpm: number,
  outgoing: Track, incoming: Track,
  hasMeta: boolean,
): TransitionPlan {
  const avgBpm = (outBpm + inBpm) / 2
  const barLen = (4 * 60) / avgBpm
  const bars = 16
  const duration = barLen * bars

  // Check if outgoing has a drumless chorus (like Die Young) — use it as a blend zone
  const outMeta = getTrackMeta(outgoing)
  const isDrumlessChorus = outMeta && outgoing.id === "sample-3" // Die Young's chorus drops drums

  return {
    durationSeconds: duration,
    technique: "bass_swap",
    explanation: `${bars}-bar EQ blend: "${incoming.title}" highs in first, bass swap at bar ${Math.round(bars * 0.65)}, "${outgoing.title}" fading.${isDrumlessChorus ? " Using drumless chorus as blend zone." : ""}`,

    // Equal-power crossfade: sin(t * PI/2)
    crossfadeAutomation: equalPowerCrossfade(12),

    // Outgoing (deck A): hold lows until 65%, then kill. Mids drop from 40%.
    deckAEqAutomation: [
      { t: 0.00, low: 0,   mid: 0,   high: 0 },
      { t: 0.30, low: 0,   mid: 0,   high: 0 },
      { t: 0.50, low: 0,   mid: -6,  high: 0 },
      { t: 0.60, low: -3,  mid: -12, high: -3 },
      { t: 0.70, low: -26, mid: -18, high: -6 },
      { t: 0.85, low: -26, mid: -26, high: -12 },
      { t: 1.00, low: -26, mid: -26, high: -26 },
    ],

    // Incoming (deck B): lows killed until bass swap. Highs first, mids second.
    deckBEqAutomation: [
      { t: 0.00, low: -26, mid: -26, high: -6 },
      { t: 0.15, low: -26, mid: -18, high: 0 },
      { t: 0.30, low: -26, mid: -12, high: 0 },
      { t: 0.50, low: -26, mid: -3,  high: 0 },
      { t: 0.60, low: -12, mid: 0,   high: 0 },
      { t: 0.70, low: 0,   mid: 0,   high: 0 },
      { t: 1.00, low: 0,   mid: 0,   high: 0 },
    ],

    fxAutomation: [
      { t: 0.00, reverb: 0,    delay: 0 },
      { t: 0.20, reverb: 0.15, delay: 0 },
      { t: 0.50, reverb: 0.25, delay: 0 },
      { t: 0.80, reverb: 0.10, delay: 0 },
      { t: 1.00, reverb: 0,    delay: 0 },
    ],
  }
}

// ─── Filter Sweep ────────────────────────────────────────────────────────────
// LPF sweep the outgoing down while opening up the incoming via EQ.
// Used for moderate BPM gaps (e.g., TiK ToK 120 → Starships 125).
function buildFilterSweepPlan(
  outBpm: number, inBpm: number,
  outgoing: Track, incoming: Track,
): TransitionPlan {
  const avgBpm = (outBpm + inBpm) / 2
  const barLen = (4 * 60) / avgBpm
  const bars = 8
  const duration = barLen * bars

  return {
    durationSeconds: duration,
    technique: "filter_sweep",
    explanation: `${bars}-bar filter sweep: sweeping "${outgoing.title}" down, "${incoming.title}" opens up.`,

    crossfadeAutomation: equalPowerCrossfade(10),

    // LPF on outgoing: 20kHz → 200Hz (logarithmic feel)
    filterAutomation: [
      { t: 0.00, cutoff: 20000, q: 0.7 },
      { t: 0.20, cutoff: 8000,  q: 1.0 },
      { t: 0.40, cutoff: 3000,  q: 1.2 },
      { t: 0.60, cutoff: 800,   q: 1.0 },
      { t: 0.80, cutoff: 300,   q: 0.7 },
      { t: 1.00, cutoff: 200,   q: 0.5 },
    ],

    deckAEqAutomation: [
      { t: 0.00, low: 0,   mid: 0,  high: 0 },
      { t: 0.60, low: -6,  mid: 0,  high: 0 },
      { t: 0.80, low: -26, mid: -6, high: -6 },
      { t: 1.00, low: -26, mid: -26, high: -26 },
    ],

    deckBEqAutomation: [
      { t: 0.00, low: -26, mid: -18, high: -6 },
      { t: 0.20, low: -26, mid: -12, high: 0 },
      { t: 0.40, low: -18, mid: -6,  high: 0 },
      { t: 0.60, low: -6,  mid: 0,   high: 0 },
      { t: 0.80, low: 0,   mid: 0,   high: 0 },
      { t: 1.00, low: 0,   mid: 0,   high: 0 },
    ],

    fxAutomation: [
      { t: 0.00, reverb: 0,    delay: 0 },
      { t: 0.30, reverb: 0.20, delay: 0.1 },
      { t: 0.60, reverb: 0.30, delay: 0.15 },
      { t: 0.85, reverb: 0.10, delay: 0.05 },
      { t: 1.00, reverb: 0,    delay: 0 },
    ],
  }
}

// ─── Echo Out / Quick Cut ────────────────────────────────────────────────────
// For big BPM gaps where blending sounds bad (e.g., FE!N 148 → Starships 125).
// Echo/reverb on outgoing → vinyl brake → hard cut to incoming.
function buildEchoOutPlan(
  outBpm: number,
  outgoing: Track, incoming: Track,
): TransitionPlan {
  const barLen = (4 * 60) / outBpm
  const bars = 4
  const duration = barLen * bars

  return {
    durationSeconds: duration,
    technique: "echo_out",
    explanation: `${bars}-bar echo out: "${outgoing.title}" fades with echo + vinyl brake, cut to "${incoming.title}".`,

    // Fast S-curve: hold outgoing until 60%, then quick swap
    crossfadeAutomation: [
      { t: 0.00, value: 0 },
      { t: 0.30, value: 0.05 },
      { t: 0.50, value: 0.15 },
      { t: 0.65, value: 0.50 },
      { t: 0.80, value: 0.90 },
      { t: 0.90, value: 0.98 },
      { t: 1.00, value: 1.0 },
    ],

    deckAEqAutomation: [
      { t: 0.00, low: 0,   mid: 0,   high: 0 },
      { t: 0.40, low: -6,  mid: 0,   high: 0 },
      { t: 0.60, low: -26, mid: -6,  high: -3 },
      { t: 0.80, low: -26, mid: -18, high: -12 },
      { t: 1.00, low: -26, mid: -26, high: -26 },
    ],

    deckBEqAutomation: [
      { t: 0.00, low: -6,  mid: 0, high: 0 },
      { t: 0.50, low: 0,   mid: 0, high: 0 },
      { t: 1.00, low: 0,   mid: 0, high: 0 },
    ],

    fxAutomation: [
      { t: 0.00, reverb: 0,    delay: 0 },
      { t: 0.15, reverb: 0.20, delay: 0.30 },
      { t: 0.40, reverb: 0.40, delay: 0.50 },
      { t: 0.60, reverb: 0.50, delay: 0.60 },
      { t: 0.80, reverb: 0.30, delay: 0.30 },
      { t: 1.00, reverb: 0,    delay: 0 },
    ],

    triggers: [
      { t: 0.70, type: "vinylBrake", deck: "outgoing", duration: 1.5 },
    ],
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Equal-power crossfade: sin(t * PI/2) maintains constant perceived loudness. */
function equalPowerCrossfade(n: number): { t: number; value: number }[] {
  const points: { t: number; value: number }[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    points.push({ t, value: Math.sin(t * Math.PI / 2) })
  }
  return points
}
