import { generateObject } from "ai"
import { xai } from "@ai-sdk/xai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Track, MusicObject } from "@/lib/types"
import { getCamelotCompatibility, CAMELOT_WHEEL } from "@/lib/types"

const transitionPlanSchema = z.object({
  startDelay: z
    .number()
    .min(0)
    .max(60)
    .describe("Seconds to wait before starting transition (to align with phrase boundaries or avoid bad timing)"),
  durationSeconds: z.number().min(8).max(120).describe("Duration of the transition in seconds (typically 16-32 bars)"),
  technique: z
    .enum([
      "bass_swap",
      "eq_blend",
      "filter_sweep",
      "echo_out",
      "quick_cut",
      "long_blend",
      "energy_drop",
      "build_up",
    ])
    .describe("Primary DJ technique to use"),
  crossfadeAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1).describe("Time position (0-1)"),
        value: z.number().min(0).max(1).describe("Crossfader position (0=A, 1=B)"),
      }),
    )
    .min(3)
    .describe("Smooth crossfader automation - avoid abrupt jumps"),
  deckAEqAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        low: z.number().min(-12).max(12).describe("Bass/sub frequencies"),
        mid: z.number().min(-12).max(12).describe("Vocal/melody frequencies"),
        high: z.number().min(-12).max(12).describe("Treble/hi-hats"),
      }),
    )
    .min(2)
    .describe("EQ automation for deck A - use for bass swapping and smooth EQ blending"),
  deckBEqAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        low: z.number().min(-12).max(12),
        mid: z.number().min(-12).max(12),
        high: z.number().min(-12).max(12),
      }),
    )
    .min(2)
    .describe("EQ automation for deck B - gradually bring in elements"),
  deckATempoAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        playbackRate: z.number().min(0.95).max(1.05).describe("Subtle tempo adjust for beatmatching (±5%)"),
      }),
    )
    .optional()
    .describe("Fine tempo adjustments for perfect beatmatching"),
  deckBTempoAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        playbackRate: z.number().min(0.95).max(1.05).describe("Subtle tempo adjust for beatmatching (±5%)"),
      }),
    )
    .optional()
    .describe("Fine tempo adjustments for perfect beatmatching"),
  filterAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        cutoff: z.number().min(20).max(20000),
        q: z.number().min(0.1).max(20),
      }),
    )
    .min(2)
    .describe("Creative filter sweeps - use highpass to remove bass, lowpass to remove highs"),
  fxAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        reverb: z.number().min(0).max(1).describe("Reverb for transitions/echoes"),
        delay: z.number().min(0).max(1).describe("Delay/echo effects for creative transitions"),
      }),
    )
    .min(2)
    .describe("FX automation - use delay for echo-out effects, reverb for atmosphere"),
  visualizerMode: z.enum(["cymatic", "particles", "tunnel", "waveform"]).optional(),
  phaseAlignment: z
    .enum(["phrase_start", "drop", "breakdown", "buildup", "outro"])
    .describe("Where in the phrase structure to start the transition"),
})

export async function POST(request: NextRequest) {
  try {
    const { trackA, trackB, currentMusicObject, userPrompt, audioContext: audioCtx } = (await request.json()) as {
      trackA: Track
      trackB: Track
      currentMusicObject: MusicObject
      userPrompt?: string
      audioContext?: {
        summary?: string
        energyPhase?: string
        averageEnergy?: number
        energyTrend?: number
        camelotA?: string | null
        camelotB?: string | null
      }
    }

    if (!trackA || !trackB) {
      return NextResponse.json({ error: "Both tracks are required" }, { status: 400 })
    }

    const bpmA = trackA.bpm || 128
    const bpmB = trackB.bpm || 128
    const bpmDiff = Math.abs(bpmA - bpmB)
    const bpmRatio = bpmB / bpmA

    // Harmonic analysis
    const camelotA = audioCtx?.camelotA ?? trackA.camelotKey ?? null
    const camelotB = audioCtx?.camelotB ?? trackB.camelotKey ?? null
    const harmonicScore = camelotA && camelotB ? getCamelotCompatibility(camelotA, camelotB) : null
    const harmonicLabel = harmonicScore !== null
      ? harmonicScore >= 0.9 ? "PERFECT" : harmonicScore >= 0.7 ? "GOOD" : harmonicScore >= 0.5 ? "OK" : "CLASH"
      : "UNKNOWN"
    const camelotAInfo = camelotA ? CAMELOT_WHEEL[camelotA] : null
    const camelotBInfo = camelotB ? CAMELOT_WHEEL[camelotB] : null

    const { object: plan } = await generateObject({
      model: xai("grok-3"),
      schema: transitionPlanSchema,
      prompt: `You are DJing a set. Analyze these tracks and create a PROFESSIONAL transition plan using ADVANCED DJ TECHNIQUES.

═══════════════════════════════════════════════════════════════
TRACK A (CURRENTLY PLAYING - OUTGOING TRACK):
═══════════════════════════════════════════════════════════════
Title: ${trackA.title}
Artist: ${trackA.artist}
Genre: ${trackA.genre || "Unknown"}
BPM: ${bpmA}
Key: ${trackA.key || "Unknown"}
Energy: ${((trackA.energy || 0.5) * 100).toFixed(0)}%
Mood: ${trackA.mood || "Unknown"}

═══════════════════════════════════════════════════════════════
TRACK B (INCOMING - NEW TRACK):
═══════════════════════════════════════════════════════════════
Title: ${trackB.title}
Artist: ${trackB.artist}
Genre: ${trackB.genre || "Unknown"}
BPM: ${bpmB}
Key: ${trackB.key || "Unknown"}
Energy: ${((trackB.energy || 0.5) * 100).toFixed(0)}%
Mood: ${trackB.mood || "Unknown"}

BPM Analysis: ${bpmDiff < 5 ? "✓ BPMs are close - perfect for beatmatching" : `⚠ ${bpmDiff} BPM difference - use subtle tempo adjustment (${bpmRatio.toFixed(3)}x)`}

═══════════════════════════════════════════════════════════════
HARMONIC ANALYSIS (Camelot Wheel):
═══════════════════════════════════════════════════════════════
Track A Key: ${camelotA ?? "Unknown"}${camelotAInfo ? ` (${camelotAInfo.key})` : ""}
Track B Key: ${camelotB ?? "Unknown"}${camelotBInfo ? ` (${camelotBInfo.key})` : ""}
Compatibility: ${harmonicLabel}${harmonicScore !== null ? ` (${(harmonicScore * 100).toFixed(0)}%)` : ""}
${harmonicScore !== null && harmonicScore < 0.5 ? "⚠ HARMONIC CLASH — use filter sweep, echo-out, or energy drop to mask the key change. Do NOT long-blend." : ""}
${harmonicScore !== null && harmonicScore >= 0.85 ? "✓ Keys are harmonically compatible — long blend or EQ blend will sound great." : ""}

${audioCtx?.summary ? `═══════════════════════════════════════════════════════════════
LIVE AUDIO CONTEXT (last 60s):
═══════════════════════════════════════════════════════════════
${audioCtx.summary}
Energy Phase: ${audioCtx.energyPhase ?? "unknown"} (trend: ${audioCtx.energyTrend !== undefined ? (audioCtx.energyTrend > 0.05 ? "rising" : audioCtx.energyTrend < -0.05 ? "falling" : "stable") : "unknown"})
` : ""}
${userPrompt ? `\n🎧 DJ Request: ${userPrompt}\n` : ""}

═══════════════════════════════════════════════════════════════
CRITICAL DJ REQUIREMENTS:
═══════════════════════════════════════════════════════════════

1. ⏱️ TIMING & PHRASING:
   - Set startDelay to align with phrase boundaries (8, 16, or 32 bar phrases)
   - NEVER transition during a build-up or right before a drop
   - Wait for a breakdown, outro, or after a drop/chorus
   - Consider the track's energy curve

2. 🎚️ BEATMATCHING:
   - If BPM difference < 6: Use minimal tempo automation (stay within ±2%)
   - If BPM difference > 6: Use tempo automation to gradually match BPMs
   - Keep playbackRate between 0.95-1.05 for natural sound
   - Beatmatch BEFORE bringing in the new track significantly

3. 🔊 EQ/BASS SWAPPING (CRITICAL):
   - START with Track B bass at -12dB (completely cut)
   - GRADUALLY swap bass frequencies between tracks:
     * As Track A bass reduces (-12dB), Track B bass increases (0dB)
   - Keep mids/highs present on both tracks initially
   - This prevents muddy low-end and maintains energy

4. 🎛️ TECHNIQUE SELECTION:
   - bass_swap: Classic technique, swap low frequencies smoothly
   - eq_blend: Gradually blend all EQ bands
   - filter_sweep: Use dramatic filter sweeps (highpass/lowpass)
   - echo_out: Echo/delay on outgoing track while bringing in new track
   - quick_cut: Fast transition (8-16 bars) for similar energy tracks
   - long_blend: Extended blend (32+ bars) for atmospheric transitions
   - energy_drop: Cut bass/filter down, then bring in new track fresh
   - build_up: Use reverb/delay to build tension before transition

5. 🎨 CREATIVE ELEMENTS:
   - Use filter sweeps to create tension (highpass sweep = builds energy)
   - Add echo/delay to outgoing track for "echo out" effect
   - Use reverb sparingly for atmosphere during breakdowns
   - Consider visualizer mode changes at key moments

6. ⏳ DURATION:
   - Quick transitions: 16-24 seconds (fast energy maintenance)
   - Standard: 24-48 seconds (most common)
   - Long blends: 48-90 seconds (atmospheric, progressive)
   - Match duration to energy difference and genre

═══════════════════════════════════════════════════════════════
CRITICAL: CROSSFADER AUTOMATION (MANDATORY!)
═══════════════════════════════════════════════════════════════
The crossfadeAutomation array controls the volume balance between decks:
- value: 0.0 = 100% Deck A, 0% Deck B (A is fully audible, B is silent)
- value: 0.5 = 50% Deck A, 50% Deck B (both at equal volume)
- value: 1.0 = 0% Deck A, 100% Deck B (A is silent, B is fully audible)

REQUIRED CROSSFADER PATTERN (smooth fade from A to B):
crossfadeAutomation: [
  { t: 0.0, value: 0.0 },   // Start: 100% on Deck A
  { t: 0.2, value: 0.1 },   // Begin bringing in B
  { t: 0.4, value: 0.3 },   // Gradual blend
  { t: 0.6, value: 0.7 },   // B becoming dominant
  { t: 0.8, value: 0.9 },   // Almost fully on B
  { t: 1.0, value: 1.0 }    // End: 100% on Deck B
]

You MUST include at least 4-6 crossfade points for a smooth transition!

═══════════════════════════════════════════════════════════════
EXAMPLE BASS SWAP TECHNIQUE:
═══════════════════════════════════════════════════════════════
Crossfade (volume balance):
t=0.0: crossfader=0.0   (100% A, 0% B)
t=0.3: crossfader=0.2   (80% A, 20% B)
t=0.5: crossfader=0.5   (50% A, 50% B)
t=0.7: crossfader=0.8   (20% A, 80% B)
t=1.0: crossfader=1.0   (0% A, 100% B)

EQ (bass swapping to avoid mud):
t=0.0: Deck A: low=0,  Deck B: low=-12  (B bass cut completely)
t=0.3: Deck A: low=0,  Deck B: low=-12  (wait for phrase)
t=0.5: Deck A: low=-6, Deck B: low=-6   (swap bass midpoint)
t=0.7: Deck A: low=-12, Deck B: low=0   (B takes over bass)
t=1.0: Deck A: low=-12, Deck B: low=0   (A bass cut completely)

═══════════════════════════════════════════════════════════════

Generate a professional, creative transition plan with SMOOTH crossfading!`,
      system: `You are a WORLD-CLASS professional DJ with 20+ years of experience. You understand:
- Phrasing (8/16/32 bar structures in electronic music)
- Beatmatching and harmonic mixing (Camelot wheel)
- EQ technique and frequency management (bass swapping is ESSENTIAL)
- Creative FX use (echo out, filter sweeps, reverb throws)
- Energy flow, energy arcs, and crowd dynamics
- Genre-specific mixing techniques

RULES:
1. MANDATORY: Create smooth crossfadeAutomation from 0.0 → 1.0 with at least 5 points
2. ALWAYS use proper bass swapping - never have both tracks at full bass simultaneously
3. ALWAYS consider timing - don't transition at bad moments
4. Use tempo automation ONLY for beatmatching (±5% max for natural sound)
5. Create SMOOTH automation curves (at least 4-6 points per parameter)
6. Match technique to the energy difference and genres
7. Be CREATIVE with filters and FX

HARMONIC MIXING RULES:
- If harmonic compatibility is PERFECT/GOOD (≥70%): use long blends, EQ blends, bass swaps — the keys will sound great together
- If compatibility is OK (50-70%): prefer shorter blends, use filter sweeps during the overlap
- If compatibility is CLASH (<50%): NEVER long-blend. Use echo-out, quick cut, or energy drop. Mask the key change with effects.
- When keys clash, cut the mids on the outgoing track EARLY to reduce dissonance

ENERGY ARC AWARENESS:
- If energy phase is "build" or "warmup": favor techniques that maintain momentum (quick_cut, build_up)
- If energy phase is "peak": use bass_swap or eq_blend to keep energy high
- If energy phase is "cooldown": long_blend or filter_sweep for smooth wind-down
- Match the transition technique to where the set is in the energy arc

The crossfader is the MOST IMPORTANT automation - without it, both tracks play at full volume!
Your transitions should sound professional and maintain dancefloor energy.`,
    })

    return NextResponse.json({
      plan,
      message: "Transition plan generated successfully",
    })
  } catch (error) {
    console.error("Transition planning error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to plan transition"
    const errorDetails = error instanceof Error ? error.stack : String(error)
    console.error("Error details:", errorDetails)
    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? errorDetails : undefined
    }, { status: 500 })
  }
}
