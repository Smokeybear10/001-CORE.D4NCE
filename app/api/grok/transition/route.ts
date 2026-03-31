import { generateObject } from "ai"
import { type NextRequest, NextResponse } from "next/server"
import { getAIModel } from "@/lib/ai-model"
import { z } from "zod"
import type { Track, MusicObject } from "@/lib/types"
import { getCamelotCompatibility, CAMELOT_WHEEL } from "@/lib/types"
import { structureToPromptText, findNextExitPoint, findBestEntryPoint, type SongStructure } from "@/lib/song-structure"

const transitionPlanSchema = z.object({
  startDelay: z
    .number()
    .describe("Seconds to WAIT before starting (0-30). Use the song structure analysis to align with the next phrase boundary. Prefer 0 unless we're mid-drop or mid-buildup. Keep it short — the user expects action."),
  durationSeconds: z.number().describe("Duration in seconds. Quick cuts: 4-8s. Standard: 12-24s. Long blends: 32-64s. Match the energy — don't drag it out."),
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
        t: z.number().describe("Time position (0-1)"),
        value: z.number().describe("Crossfader position (0=A, 1=B)"),
      }),
    )
    .describe("Smooth crossfader curve. 6-8 points. Start at 0.0, end at 1.0. Shape it to the music."),
  deckAEqAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        low: z.number().describe("Bass/sub frequencies (-12 to 12 dB)"),
        mid: z.number().describe("Vocal/melody frequencies (-12 to 12 dB)"),
        high: z.number().describe("Treble/hi-hats (-12 to 12 dB)"),
      }),
    )
    .describe("REQUIRED. EQ sculpting for outgoing deck A. 5-8 points. Actively shape each band — cut bass, duck mids, reduce highs as track exits."),
  deckBEqAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        low: z.number().describe("Bass/sub (-12 to 12 dB)"),
        mid: z.number().describe("Vocal/melody (-12 to 12 dB)"),
        high: z.number().describe("Treble (-12 to 12 dB)"),
      }),
    )
    .describe("REQUIRED. EQ sculpting for incoming deck B. 5-8 points. Start with bass at -12dB, gradually open each band independently."),
  deckATempoAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        playbackRate: z.number().describe("Subtle tempo adjust for beatmatching, 0.95-1.05 (±5%)"),
      }),
    )
    .optional()
    .describe("Fine tempo adjustments for perfect beatmatching"),
  deckBTempoAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        playbackRate: z.number().describe("Subtle tempo adjust for beatmatching, 0.95-1.05 (±5%)"),
      }),
    )
    .optional()
    .describe("Fine tempo adjustments for perfect beatmatching"),
  filterAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        cutoff: z.number().describe("Filter cutoff frequency (20-20000 Hz)"),
        q: z.number().describe("Filter resonance Q (0.1-20)"),
      }),
    )
    .describe("REQUIRED. Filter sweep automation. 3-5 points. Don't leave flat — sweep it for texture/tension. Use Q resonance (2-8) at peaks."),
  fxAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        reverb: z.number().describe("Reverb amount 0-1 — peak 0.2-0.5 during blend midpoint"),
        delay: z.number().describe("Delay/echo amount 0-1 — peak 0.1-0.4 for echo trails"),
        flangerMix: z.number().optional().describe("Flanger amount 0-0.3 — subtle texture, 0.05-0.15 during sweeps"),
      }),
    )
    .describe("REQUIRED. FX arc — ramp up reverb+delay during blend, peak at midpoint, resolve to 0 at end. 4-6 points."),
  deckAIsolationAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        bass: z.number().describe("Bass stem 0-1 (0=muted, 1=full). Preferred over EQ low for clean bass swaps"),
        voice: z.number().describe("Vocal stem 0-1 (0=muted, 1=full). Mute to avoid vocal clashes"),
        melody: z.number().describe("Melody/synth stem 0-1 (0=muted, 1=full)"),
      }),
    )
    .describe("REQUIRED. Stem isolation for outgoing Deck A — gradually remove stems. Start at 1,1,1 and end at 0,0,0. If using stem bass, keep EQ low at 0."),
  deckBIsolationAutomation: z
    .array(
      z.object({
        t: z.number().describe("Time position (0-1)"),
        bass: z.number().describe("Bass stem 0-1 (0=muted, 1=full)"),
        voice: z.number().describe("Vocal stem 0-1 (0=muted, 1=full)"),
        melody: z.number().describe("Melody/synth stem 0-1 (0=muted, 1=full)"),
      }),
    )
    .describe("REQUIRED. Stem isolation for incoming Deck B — gradually introduce stems. Start at 0,0,0 and end at 1,1,1. If using stem bass, keep EQ low at 0."),
  triggers: z
    .array(
      z.object({
        t: z.number().describe("Progress point to fire (0-1)"),
        type: z.enum(["vinylBrake", "spinback"]).describe("vinylBrake: slow-stop effect. spinback: reverse scratch"),
        deck: z.enum(["outgoing", "incoming"]).describe("Which deck to apply the effect to"),
        duration: z.number().optional().describe("Effect duration in seconds 0.2-3 (default ~1s)"),
      }),
    )
    .optional()
    .describe("One-shot effects fired at specific transition points. Use vinylBrake only for quick_cut/energy_drop on outgoing deck"),
  incomingStartSeconds: z
    .number()
    .describe("REQUIRED. Seconds into the incoming track to start playback (0 or more). Use the incoming song structure analysis to skip past intros. Set to 0 only if the intro is short (<16 bars) or you want the intro to blend under the outgoing track."),
  visualizerMode: z.enum(["cymatic", "tunnel", "waveform", "spectrum"]).optional(),
  phaseAlignment: z
    .enum(["phrase_start", "drop", "breakdown", "buildup", "outro"])
    .describe("Where in the phrase structure to start the transition"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const modelOverride = body.model as string | undefined
    const { trackA, trackB, currentMusicObject, userPrompt, audioContext: audioCtx, currentTimeA, durationA, currentTimeB, durationB, outgoingDeck, outgoingStructure, incomingStructure } = body as {
      trackA: Track
      trackB: Track
      currentMusicObject: MusicObject
      userPrompt?: string
      currentTimeA?: number
      durationA?: number
      currentTimeB?: number
      durationB?: number
      outgoingDeck?: "A" | "B"
      outgoingStructure?: SongStructure
      incomingStructure?: SongStructure
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

    // Determine the actual outgoing/incoming tracks based on which deck is outgoing
    const actualOutgoing = outgoingDeck === "B" ? trackB : trackA
    const actualIncoming = outgoingDeck === "B" ? trackA : trackB
    const outgoingTime = outgoingDeck === "B" ? currentTimeB : currentTimeA
    const outgoingDuration = outgoingDeck === "B" ? durationB : durationA
    const incomingTime = outgoingDeck === "B" ? currentTimeA : currentTimeB
    const incomingDuration = outgoingDeck === "B" ? durationA : durationB

    const bpmA = trackA.bpm || 128
    const bpmB = trackB.bpm || 128
    const bpmOut = actualOutgoing.bpm || 128
    const bpmIn = actualIncoming.bpm || 128
    const bpmDiff = Math.abs(bpmOut - bpmIn)
    const bpmRatio = bpmIn / bpmOut

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
      model: getAIModel(modelOverride),
      schema: transitionPlanSchema,
      prompt: `You are DJing a set. Analyze these tracks and create a PROFESSIONAL transition plan using ADVANCED DJ TECHNIQUES.

IMPORTANT: Your plan is ALWAYS generated as A→B (outgoing=Deck A, incoming=Deck B, crossfader 0→1).
The system will automatically flip everything if the actual direction is B→A.

═══════════════════════════════════════════════════════════════
OUTGOING TRACK (Deck A in your plan — currently playing):
═══════════════════════════════════════════════════════════════
Title: ${actualOutgoing.title}
Artist: ${actualOutgoing.artist}
Genre: ${actualOutgoing.genre || "Unknown"}
BPM: ${bpmOut}
Key: ${actualOutgoing.key || "Unknown"}
Energy: ${((actualOutgoing.energy || 0.5) * 100).toFixed(0)}%
Mood: ${actualOutgoing.mood || "Unknown"}
${outgoingTime !== undefined && outgoingDuration ? `Playback: ${Math.floor(outgoingTime / 60)}:${String(Math.floor(outgoingTime % 60)).padStart(2, "0")} / ${Math.floor(outgoingDuration / 60)}:${String(Math.floor(outgoingDuration % 60)).padStart(2, "0")} (${((outgoingTime / outgoingDuration) * 100).toFixed(0)}% through)
Remaining: ${Math.floor((outgoingDuration - outgoingTime) / 60)}:${String(Math.floor((outgoingDuration - outgoingTime) % 60)).padStart(2, "0")}` : "Playback position: Unknown"}

═══════════════════════════════════════════════════════════════
INCOMING TRACK (Deck B in your plan — about to start):
═══════════════════════════════════════════════════════════════
Title: ${actualIncoming.title}
Artist: ${actualIncoming.artist}
Genre: ${actualIncoming.genre || "Unknown"}
BPM: ${bpmIn}
Key: ${actualIncoming.key || "Unknown"}
Energy: ${((actualIncoming.energy || 0.5) * 100).toFixed(0)}%
Mood: ${actualIncoming.mood || "Unknown"}
${incomingDuration ? `Duration: ${Math.floor(incomingDuration / 60)}:${String(Math.floor(incomingDuration % 60)).padStart(2, "0")}` : ""}

BPM Analysis: ${bpmDiff < 5 ? "✓ BPMs are close - perfect for beatmatching" : `⚠ ${bpmDiff} BPM difference - use subtle tempo adjustment (${bpmRatio.toFixed(3)}x)`}

═══════════════════════════════════════════════════════════════
HARMONIC ANALYSIS (Camelot Wheel):
═══════════════════════════════════════════════════════════════
Track A Key: ${camelotA ?? "Unknown"}${camelotAInfo ? ` (${camelotAInfo.key})` : ""}
Track B Key: ${camelotB ?? "Unknown"}${camelotBInfo ? ` (${camelotBInfo.key})` : ""}
Compatibility: ${harmonicLabel}${harmonicScore !== null ? ` (${(harmonicScore * 100).toFixed(0)}%)` : ""}
${harmonicScore !== null && harmonicScore < 0.5 ? "⚠ HARMONIC CLASH — use filter sweep, echo-out, or energy drop to mask the key change. Do NOT long-blend." : ""}
${harmonicScore !== null && harmonicScore >= 0.85 ? "✓ Keys are harmonically compatible — long blend or EQ blend will sound great." : ""}

═══════════════════════════════════════════════════════════════
SONG STRUCTURE AWARENESS (analyzed from audio):
═══════════════════════════════════════════════════════════════
${(() => {
  const lines: string[] = []
  const remaining = outgoingTime !== undefined && outgoingDuration ? outgoingDuration - outgoingTime : null

  // OUTGOING track structure
  if (outgoingStructure) {
    lines.push(structureToPromptText(outgoingStructure, "OUTGOING", outgoingTime, outgoingDuration))
    if (outgoingTime !== undefined) {
      const exit = findNextExitPoint(outgoingStructure, outgoingTime)
      lines.push(`\n  >>> RECOMMENDED: Wait ${exit.delay.toFixed(0)}s (startDelay=${exit.delay.toFixed(0)}) — ${exit.reason}`)
    }
  } else if (outgoingTime !== undefined && outgoingDuration) {
    const pct = outgoingTime / outgoingDuration
    const estimatedBars = Math.round((outgoingDuration - outgoingTime) / (60 / bpmOut) / 4)
    let section = "middle"
    if (pct < 0.1) section = "intro"
    else if (pct < 0.3) section = "early section (verse/buildup)"
    else if (pct < 0.5) section = "mid section (chorus/drop zone)"
    else if (pct < 0.75) section = "late section (breakdown/bridge)"
    else if (pct < 0.9) section = "near end (outro approaching)"
    else section = "outro"
    lines.push(`  OUTGOING estimated section: ${section}, ~${estimatedBars} bars remaining (no structure analysis available)`)
  }

  // INCOMING track structure
  if (incomingStructure) {
    lines.push("")
    lines.push(structureToPromptText(incomingStructure, "INCOMING", incomingTime, incomingDuration))
    const entry = findBestEntryPoint(incomingStructure)
    lines.push(`\n  >>> RECOMMENDED ENTRY POINT: ${entry.time.toFixed(1)}s — ${entry.reason}`)
    lines.push(`  Set incomingStartSeconds=${entry.time.toFixed(1)} to cue the incoming track here.`)
  }

  if (remaining !== null) {
    if (remaining < 30) lines.push("\n  ⚠ URGENT: Less than 30 seconds left on outgoing — use a shorter transition!")
    else if (remaining < 60) lines.push(`\n  ⚡ Under 1 minute remaining — keep transition duration under ${Math.floor(remaining * 0.7)}s`)
  }

  return lines.join("\n")
})()}

STRUCTURE RULES:
- Most songs follow: Intro → Verse → Buildup → Drop/Chorus → Breakdown → Drop2 → Outro
- Phrases are typically 8 or 16 bars (${(60 / bpmOut * 4 * 8).toFixed(0)}s for 8 bars, ${(60 / bpmOut * 4 * 16).toFixed(0)}s for 16 bars at ${bpmOut} BPM)
- Use the song structure analysis above to find the EXACT right moment
- Set startDelay to wait for the next phrase boundary / breakdown / outro
- Set incomingStartSeconds to skip the incoming track's intro if it's long
- NEVER start during a buildup — it kills the energy
- If the outgoing track is at a drop, wait for it to resolve (the analysis shows you when)
- If the outgoing track is in a breakdown or outro, start transitioning NOW

═══════════════════════════════════════════════════════════════
CURRENT MIXER STATE:
═══════════════════════════════════════════════════════════════
Crossfader: ${((currentMusicObject.crossfader ?? 0.5) * 100).toFixed(0)}% (0%=Deck A, 100%=Deck B)
Master EQ: Low ${currentMusicObject.eq?.low ?? 0}dB, Mid ${currentMusicObject.eq?.mid ?? 0}dB, High ${currentMusicObject.eq?.high ?? 0}dB
${currentMusicObject.perDeckEq ? `Per-Deck EQ A: Low ${currentMusicObject.perDeckEq.A.low}dB, Mid ${currentMusicObject.perDeckEq.A.mid}dB, High ${currentMusicObject.perDeckEq.A.high}dB
Per-Deck EQ B: Low ${currentMusicObject.perDeckEq.B.low}dB, Mid ${currentMusicObject.perDeckEq.B.mid}dB, High ${currentMusicObject.perDeckEq.B.high}dB` : "Per-Deck EQ: All neutral (0dB)"}
Filter: ${currentMusicObject.filter?.type ?? "lowpass"} @ ${currentMusicObject.filter?.cutoff ?? 20000}Hz
Reverb: ${((currentMusicObject.reverbAmount ?? 0) * 100).toFixed(0)}%, Delay: ${((currentMusicObject.delayAmount ?? 0) * 100).toFixed(0)}%
${currentMusicObject.tracks?.A?.bassIsolation !== undefined ? `Deck A Isolation: Bass=${currentMusicObject.tracks.A.bassIsolation}, Voice=${currentMusicObject.tracks.A.voiceIsolation}, Melody=${currentMusicObject.tracks.A.melodyIsolation}` : ""}
${currentMusicObject.tracks?.B?.bassIsolation !== undefined ? `Deck B Isolation: Bass=${currentMusicObject.tracks.B.bassIsolation}, Voice=${currentMusicObject.tracks.B.voiceIsolation}, Melody=${currentMusicObject.tracks.B.melodyIsolation}` : ""}

Your EQ/Isolation starting values should match or smoothly transition from these current values!

${audioCtx?.summary ? `═══════════════════════════════════════════════════════════════
LIVE AUDIO CONTEXT (last 60s):
═══════════════════════════════════════════════════════════════
${audioCtx.summary}
Energy Phase: ${audioCtx.energyPhase ?? "unknown"} (trend: ${audioCtx.energyTrend !== undefined ? (audioCtx.energyTrend > 0.05 ? "rising" : audioCtx.energyTrend < -0.05 ? "falling" : "stable") : "unknown"})
` : ""}
${userPrompt ? `\n🎧 DJ Request: ${userPrompt}\n` : ""}

═══════════════════════════════════════════════════════════════
YOU MUST USE ALL OF THESE TOOLS AGGRESSIVELY:
═══════════════════════════════════════════════════════════════

You have 7 powerful mixing tools. A good DJ uses ALL of them together, not just the crossfader.
Lazy transitions that only move the crossfader sound amateur. USE EVERYTHING.

TOOL 1 — CROSSFADER (volume balance A↔B):
  - 0.0 = 100% A, 1.0 = 100% B
  - Include 6-8 points minimum for smooth curves
  - DON'T just do a linear fade — shape it to the music

TOOL 2 — PER-DECK EQ (deckAEqAutomation + deckBEqAutomation):
  - This is your PRIMARY mixing tool. Use it on EVERY transition.
  - Low (-12 to +12 dB): Controls bass/sub. ALWAYS bass-swap between decks.
  - Mid (-12 to +12 dB): Controls vocals/melody body. Cut outgoing mids to reduce clashes.
  - High (-12 to +12 dB): Controls hi-hats/air/brightness. Use to shape energy.
  - Include 5-8 points per deck. Shape each band independently.
  - BASS SWAP IS NON-NEGOTIABLE: At no point should both decks have bass above -3dB.
  - Sculpt the mids: As incoming track grows, cut outgoing mids to make room.
  - Use highs creatively: Bring in incoming highs early (hi-hats blend well).

TOOL 3 — STEM ISOLATION (deckAIsolationAutomation + deckBIsolationAutomation):
  - bass (0-1): Bass/kick separation. Cleaner than EQ for bass swaps.
  - voice (0-1): Vocal isolation. ESSENTIAL for avoiding vocal clashes.
  - melody (0-1): Synths/leads/melody. Use to gradually introduce incoming melodies.
  - USE THIS ON EVERY TRANSITION. Include 4-6 points per deck.
  - Start incoming deck with bass=0, voice=0, melody=0.5
  - Gradually bring in stems while removing outgoing stems.
  - NEVER have both decks' vocals at full volume simultaneously.
  - The winning deck MUST end at bass=1, voice=1, melody=1.
  - ⚠️ If using stem bass isolation, keep EQ low at 0 on that deck (pick one, not both).

TOOL 4 — FILTER SWEEPS (filterAutomation):
  - Highpass sweep (cutoff 20→2000→8000): Removes bass, creates tension/buildup feel.
  - Lowpass sweep (cutoff 20000→1000→200): Removes highs, creates underwater/muffled feel.
  - Use Q resonance (2-8) at the sweep peak for that classic filter resonance sound.
  - GREAT for masking key clashes and creating energy arcs.
  - Include 4-6 points. Don't just set it and forget — sweep it dynamically.

TOOL 5 — FX (fxAutomation — reverb, delay, flanger):
  - Reverb (0-1): Atmosphere. Use during breakdowns, ramp up to 0.3-0.5 during blend.
  - Delay (0-1): Echo trails. Amazing for echo-out transitions. Ramp to 0.4-0.7.
  - Flanger (0-0.3): Swirling modulation. Subtle but adds texture during sweeps.
  - Don't leave FX at 0 the whole time — use them! Ramp up during the blend, back to 0 at end.
  - Include 4-6 points. Create FX arcs that peak during the transition midpoint.

TOOL 6 — TEMPO (deckATempoAutomation + deckBTempoAutomation):
  - If BPM differs by >3, gradually match tempos during the blend.
  - Adjust the incoming track toward the outgoing BPM, then settle.
  - Keep within 0.95-1.05 (±5%). Start matching BEFORE the crossfader moves significantly.

TOOL 7 — TRIGGERS (one-shot effects):
  - vinylBrake on outgoing deck at t=0.85-0.95 for quick_cut/energy_drop.
  - spinback for dramatic hard cuts.
  - Only use when the technique calls for it. One per transition max.

═══════════════════════════════════════════════════════════════
TIMING — USE THE SONG STRUCTURE:
═══════════════════════════════════════════════════════════════
The song structure analysis above gives you EXACT sections and phrase boundaries.
Use this data to make intelligent timing decisions:

startDelay (0-30s): How long to WAIT before beginning the transition.
  - If we're in a drop → wait a few seconds for it to resolve, but don't wait forever
  - If we're in a buildup → wait for the drop to hit, then start
  - If we're in a breakdown or outro → start immediately (delay=0)
  - PREFER SMALL DELAYS (0-10s). Only use 10-30s if we're truly stuck in a buildup.
  - The analysis above includes a RECOMMENDED startDelay — use it but round DOWN, not up.

incomingStartSeconds: Where to CUE the incoming track.
  - Skip long intros — jump to the first verse/buildup
  - The analysis above includes a RECOMMENDED entry point — use it.
  - If the incoming song has no structure data, start from 0.
  - IMPORTANT: The incoming track starts playing IMMEDIATELY (silently behind the crossfader).
    It plays for startDelay seconds before the blend begins. Account for this:
    If you want the blend to catch the incoming track at a chorus that's at 30s,
    and startDelay=10s, set incomingStartSeconds=20 (30-10=20).

Phrases are ${(60 / bpmOut * 4 * 8).toFixed(0)}s (8 bars) or ${(60 / bpmOut * 4 * 16).toFixed(0)}s (16 bars) at ${bpmOut} BPM.
Align your transition duration to phrase multiples for professional results.

═══════════════════════════════════════════════════════════════
TECHNIQUE DECISION TREE:
═══════════════════════════════════════════════════════════════
Choose based on the tracks — KEEP IT TIGHT, don't drag transitions out:

Same genre + similar BPM + compatible keys → bass_swap or eq_blend (12-24s)
  Use: Heavy EQ work, stem isolation, subtle FX. This should sound seamless.

Same genre + similar BPM + clashing keys → filter_sweep or echo_out (8-16s)
  Use: Aggressive filter sweep to mask the key clash. Heavy reverb/delay on outgoing.

Different energy levels → energy_drop or build_up (12-24s)
  Use: If going UP: build_up with filter sweep + reverb into the drop.
        If going DOWN: energy_drop, cut bass, filter down, let incoming breathe.

Very different BPMs (>8 diff) → quick_cut or echo_out (4-12s)
  Use: Don't try to beatmatch, just do a clean handoff. Echo/reverb on outgoing.

Similar vibe/genre → long_blend (24-48s)
  Use: Gradual everything. Slow EQ sculpting, stem blending, gentle filter movement.

DEFAULT TO SHORTER. A tight 12s transition sounds more professional than a drawn-out 48s one.

═══════════════════════════════════════════════════════════════
FULL EXAMPLE — PROFESSIONAL bass_swap TRANSITION (32s):
═══════════════════════════════════════════════════════════════

crossfadeAutomation (8 points):
  t=0.00: 0.00  |  t=0.10: 0.05  |  t=0.25: 0.15  |  t=0.40: 0.35
  t=0.55: 0.55  |  t=0.70: 0.75  |  t=0.85: 0.92  |  t=1.00: 1.00

deckAEqAutomation (6 points):
  t=0.00: low=0, mid=0, high=0
  t=0.25: low=0, mid=0, high=-2         (start reducing A highs slightly)
  t=0.40: low=-4, mid=-3, high=-4       (start pulling A back)
  t=0.55: low=-8, mid=-6, high=-6       (A stepping down hard)
  t=0.75: low=-12, mid=-9, high=-8      (A almost gone)
  t=1.00: low=-12, mid=-12, high=-12    (A fully cut)

deckBEqAutomation (6 points):
  t=0.00: low=-12, mid=-6, high=-3      (B bass cut, some mids/highs bleeding through)
  t=0.20: low=-12, mid=-4, high=-1      (B highs coming in first)
  t=0.40: low=-8, mid=-2, high=0        (B mids opening up)
  t=0.55: low=-3, mid=0, high=0         (B bass starting to come in as A bass drops)
  t=0.75: low=0, mid=0, high=0          (B fully open)
  t=1.00: low=0, mid=0, high=0          (B clean)

deckAIsolationAutomation (5 points):
  t=0.00: bass=1, voice=1, melody=1
  t=0.30: bass=1, voice=0.7, melody=0.8 (start ducking A vocals/melody)
  t=0.50: bass=0.5, voice=0.3, melody=0.5
  t=0.75: bass=0, voice=0, melody=0.2
  t=1.00: bass=0, voice=0, melody=0

deckBIsolationAutomation (5 points):
  t=0.00: bass=0, voice=0, melody=0.3   (just a hint of B melody)
  t=0.25: bass=0, voice=0.3, melody=0.5 (B melody growing)
  t=0.45: bass=0.5, voice=0.6, melody=0.8 (B stems coming in)
  t=0.65: bass=1, voice=0.8, melody=1   (B bass drops in)
  t=1.00: bass=1, voice=1, melody=1     (B fully active)

filterAutomation (4 points):
  t=0.00: cutoff=20000, q=1
  t=0.30: cutoff=8000, q=2              (slight filter sweep for texture)
  t=0.60: cutoff=14000, q=1.5
  t=1.00: cutoff=20000, q=1             (back to fully open)

fxAutomation (5 points):
  t=0.00: reverb=0, delay=0, flangerMix=0
  t=0.20: reverb=0.15, delay=0.1, flangerMix=0.05
  t=0.45: reverb=0.3, delay=0.2, flangerMix=0.1   (FX peak during blend)
  t=0.75: reverb=0.1, delay=0.05, flangerMix=0.03
  t=1.00: reverb=0, delay=0, flangerMix=0          (clean exit)

THIS is what a real transition looks like. Every tool working together.
DO NOT generate a transition with flat/empty EQ, empty isolation, or zero FX.

Generate an aggressive, professional transition that sounds like a world-class DJ mixed it.`,
      system: `You are a WORLD-CLASS DJ performing at a major festival. You are known for your flawless, TIGHT transitions.

Your philosophy: A transition should be SEAMLESS and FAST. The best transitions are ones the crowd doesn't even notice happened. Use ALL tools aggressively but keep durations SHORT — 12-24s is the sweet spot for most transitions. Only go longer (32-48s) for deliberate long blends between similar tracks. Quick cuts should be 4-8s.

SPEED IS KEY: Don't pad transitions. A tight 12-second bass swap with aggressive EQ/ISO work sounds 10x better than a lazy 48-second linear fade. Be decisive.

HARD RULES (violations = amateur hour):
1. crossfadeAutomation: 6-8 points minimum. Smooth S-curve, not linear.
2. deckAEqAutomation: 5-8 points. Actively sculpt each band (low/mid/high independently).
3. deckBEqAutomation: 5-8 points. Start incoming with bass at -12dB, gradually open up.
4. BASS SWAP: At NO point should both decks have bass above -3dB. This is the #1 amateur mistake.
5. deckAIsolationAutomation: ALWAYS include this. 4-6 points. Gradually remove outgoing stems.
6. deckBIsolationAutomation: ALWAYS include this. 4-6 points. Gradually introduce incoming stems.
7. filterAutomation: 3-5 points. NEVER leave it flat at 20kHz the whole time. Move it.
8. fxAutomation: 4-6 points. Create an FX arc — ramp up during blend, back to 0 at end.
9. Reverb should peak at 0.2-0.5 during the blend midpoint. Delay at 0.1-0.4.
10. Tempo automation if BPMs differ by >3.
11. incomingStartSeconds: ALWAYS SET THIS. Use the incoming song structure to skip past the intro.
    If structure says bestEntryPoint=25s, set incomingStartSeconds=25 (minus startDelay if applicable).
    NEVER leave it at 0 if the incoming track has a long intro — the listener will hear dead air.

STEM ISOLATION STRATEGY:
- Start incoming deck with all stems at 0 or very low
- Bring in melody/highs first (t=0.1-0.3) — they blend easily
- Bring in vocals carefully — NEVER overlap both decks' vocals at full
- Bass is the LAST stem to bring in on incoming, FIRST to remove on outgoing
- This creates natural "layers" that unfold over time

EQ SCULPTING STRATEGY:
- Think of each band as independent. Don't just move all three together.
- Highs first: Incoming highs can appear early (hi-hats/cymbals blend well)
- Mids next: As incoming mids grow, cut outgoing mids to make space
- Bass last: The bass swap is the dramatic moment — it should happen decisively, not gradually
- Use EQ boosts (+2 to +4dB) on incoming to make elements pop, not just cuts

FILTER STRATEGY:
- For TENSION: Highpass sweep outgoing from 20→3000Hz while incoming enters clean
- For ATMOSPHERE: Gentle lowpass dip to 8000-12000Hz during blend, back to 20kHz
- Use Q resonance (3-8) at the sweep peak for that DJ filter sound
- Sweep timing should match phrase boundaries

FX STRATEGY:
- Echo-out: Ramp delay to 0.3-0.6 on outgoing while muting it — creates trailing echoes
- Atmosphere: Reverb 0.2-0.4 during breakdown blends
- Texture: Flanger 0.05-0.15 during filter sweeps for movement
- FX should ARC: build up → peak → resolve. Never flat.

TIMING INTELLIGENCE (YOU HAVE REAL SONG STRUCTURE DATA — USE IT):
- The prompt includes ANALYZED song structure with exact sections, phrase boundaries, and recommended timing.
- Use startDelay to wait for the RIGHT MOMENT. The analysis gives you the optimal delay.
- Use incomingStartSeconds to skip the incoming track's intro if it's long.
- If the outgoing is in a drop: Wait for it to resolve (set startDelay per the recommendation).
- If the outgoing is in a breakdown/outro: Start now (startDelay=0).
- If the outgoing is in a buildup: NEVER interrupt — wait until after the drop.
- The transition duration should NEVER exceed the remaining time on the outgoing track.
- A professional DJ waits for the RIGHT MOMENT, even if that means a 20-30s startDelay.

HARMONIC RULES:
- Compatible keys (≥70%): Go wild with long blends and open EQ
- Clashing keys (<50%): MASK IT. Heavy filter sweep, FX wash, quick bass swap. Cut outgoing mids early.
- Use the filter as a key-clash shield — highpass the outgoing to remove the clashing fundamentals

ENERGY MATCHING:
- High→High: bass_swap or eq_blend. Keep it tight and punchy.
- High→Low: energy_drop. Cut bass + filter sweep down, let new track breathe in quietly.
- Low→High: build_up. Reverb/filter tension into the incoming track's drop.
- Similar energy: long_blend or eq_blend with heavy stem work.

Your transitions should sound like they belong on a festival main stage recording.`,
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
