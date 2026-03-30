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
        flangerMix: z.number().min(0).max(0.3).optional().describe("Flanger wet/dry mix (0=off, max 0.3). Use for filter_sweep, echo_out, build_up techniques"),
      }),
    )
    .min(2)
    .describe("FX automation - use delay for echo-out effects, reverb for atmosphere, flanger for modulation texture"),
  deckAIsolationAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        bass: z.number().min(0).max(1).describe("Bass stem (0=muted, 1=full). Preferred over EQ low for clean bass swaps"),
        voice: z.number().min(0).max(1).describe("Vocal stem (0=muted, 1=full). Mute to avoid vocal clashes"),
        melody: z.number().min(0).max(1).describe("Melody/synth stem (0=muted, 1=full)"),
      }),
    )
    .optional()
    .describe("Stem isolation for Deck A. WARNING: Do NOT combine with deckAEqAutomation low cuts — causes double-cutting artifacts"),
  deckBIsolationAutomation: z
    .array(
      z.object({
        t: z.number().min(0).max(1),
        bass: z.number().min(0).max(1),
        voice: z.number().min(0).max(1),
        melody: z.number().min(0).max(1),
      }),
    )
    .optional()
    .describe("Stem isolation for Deck B. WARNING: Do NOT combine with deckBEqAutomation low cuts — causes double-cutting artifacts"),
  triggers: z
    .array(
      z.object({
        t: z.number().min(0).max(1).describe("Progress point to fire (0-1)"),
        type: z.enum(["vinylBrake", "spinback"]).describe("vinylBrake: slow-stop effect. spinback: reverse scratch"),
        deck: z.enum(["outgoing", "incoming"]).describe("Which deck to apply the effect to"),
        duration: z.number().min(0.2).max(3).optional().describe("Effect duration in seconds (default ~1s)"),
      }),
    )
    .optional()
    .describe("One-shot effects fired at specific transition points. Use vinylBrake only for quick_cut/energy_drop on outgoing deck"),
  visualizerMode: z.enum(["cymatic", "tunnel", "waveform", "spectrum"]).optional(),
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

6. 🎛️ STEM ISOLATION (ADVANCED — preferred over EQ for clean separation):
   - Each deck has bass, voice, melody stems (0=muted, 1=full)
   - STEM BASS SWAP: Instead of EQ low cuts, mute bass stem on incoming deck, then swap:
     * t=0.0: Deck A bass=1, Deck B bass=0  (only A bass audible)
     * t=0.4: Deck A bass=1, Deck B bass=0  (wait for phrase boundary)
     * t=0.5: Deck A bass=0, Deck B bass=1  (instant clean swap at the drop/phrase)
     * t=1.0: Deck A bass=0, Deck B bass=1
   - VOCAL CLASH AVOIDANCE: If both tracks have vocals, mute voice on outgoing during overlap:
     * t=0.3: Deck A voice=0.5 (duck outgoing vocals as B comes in)
     * t=0.6: Deck A voice=0   (fully mute outgoing vocals)
   - ⚠️ NEVER combine stem isolation bass with EQ low cuts on the SAME deck — causes double-cutting

7. 🌀 FLANGER MODULATION:
   - Use flangerMix in fxAutomation (0=off, max 0.3)
   - Best for: filter_sweep, echo_out, build_up techniques
   - Ramp: 0→0.2 from t=0.2-0.5, hold, back to 0 by t=0.9
   - Adds swirling texture during blends — don't overuse

8. 💥 ONE-SHOT TRIGGERS:
   - vinylBrake: Slow-stop effect on outgoing deck. Only for quick_cut or energy_drop
   - spinback: Reverse scratch. Dramatic effect for hard transitions
   - Fire at t=0.8-0.95 on the outgoing deck for maximum impact
   - Use sparingly — one trigger per transition maximum

9. ⏳ DURATION:
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

STEM ISOLATION vs EQ RULES:
8. NEVER use stem isolation bass + EQ low cuts on the same deck simultaneously — this double-cuts and sounds hollow
9. If using deckAIsolationAutomation, keep deckAEqAutomation low at 0 (neutral). Pick ONE approach per deck.
10. Prefer stem isolation for bass swaps (cleaner separation) and EQ for subtle tonal shaping
11. Vocal isolation is great for avoiding clashes — mute outgoing vocals when incoming vocals are prominent

TRIGGER RULES:
12. vinylBrake ONLY for quick_cut or energy_drop techniques, on the OUTGOING deck
13. spinback ONLY for dramatic hard cuts, on the OUTGOING deck
14. Maximum ONE trigger per transition
15. Fire triggers at t=0.8-0.95 (near the end of the transition)

FLANGER RULES:
16. flangerMix max 0.3 — subtle modulation texture only
17. Best paired with filter_sweep, echo_out, or build_up techniques
18. Ramp up gradually, always return to 0 before transition ends
19. Do NOT use flanger for quick_cut transitions

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
