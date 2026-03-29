import { generateObject } from "ai"
import { xai } from "@ai-sdk/xai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Track } from "@/lib/types"
import { scoreLibrary } from "@/lib/track-scorer"

const recommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      trackId: z.string().describe("ID of the recommended track"),
      reason: z.string().describe("Why this track is recommended"),
      compatibilityScore: z.number().min(0).max(1).describe("How well it matches"),
      suggestedTransition: z.string().describe("Suggested transition style"),
    }),
  ),
  explanation: z.string().describe("Overall recommendation strategy"),
})

export async function POST(request: NextRequest) {
  try {
    const { currentTrack, library, userPrompt, energyPhase, playedTrackIds } = (await request.json()) as {
      currentTrack: Track
      library: Track[]
      userPrompt?: string
      energyPhase?: string
      playedTrackIds?: string[]
    }

    if (!currentTrack || !library?.length) {
      return NextResponse.json({ error: "Current track and library are required" }, { status: 400 })
    }

    // Pre-score tracks deterministically before sending to LLM
    // This dramatically reduces token usage and improves recommendation quality
    const scored = scoreLibrary(currentTrack, library, {
      excludeIds: playedTrackIds,
      maxResults: 10,
    })

    if (scored.length === 0) {
      return NextResponse.json({
        recommendations: [],
        explanation: "No other tracks in library to recommend",
      })
    }

    // Build rich descriptions with pre-computed scores
    const libraryDescription = scored
      .map(
        (s, i) =>
          `#${i + 1} [Score: ${(s.score * 100).toFixed(0)}%] ID: ${s.track.id}, Title: "${s.track.title}", Artist: "${s.track.artist}", Genre: ${s.track.genre || "Unknown"}, BPM: ${s.track.bpm || "Unknown"}, Key: ${s.track.camelotKey || s.track.key || "Unknown"}, Energy: ${s.track.energy || 0.5}${s.camelotCompat !== null ? `, Harmonic: ${(s.camelotCompat * 100).toFixed(0)}%` : ""}${s.bpmDiff !== null ? `, BPM Diff: ${s.bpmDiff.toFixed(1)}` : ""}, Note: ${s.mixNote}`,
      )
      .join("\n")

    const { object: recommendations } = await generateObject({
      model: xai("grok-3"),
      schema: recommendationSchema,
      prompt: `Recommend the next tracks to play after this current track:

CURRENTLY PLAYING:
- Title: ${currentTrack.title}
- Artist: ${currentTrack.artist}
- Genre: ${currentTrack.genre || "Unknown"}
- BPM: ${currentTrack.bpm || "Unknown"}
- Camelot Key: ${currentTrack.camelotKey || currentTrack.key || "Unknown"}
- Energy: ${currentTrack.energy || 0.5}
- Mood: ${currentTrack.mood || "Unknown"}
${energyPhase ? `- Current Set Phase: ${energyPhase}` : ""}

PRE-RANKED CANDIDATES (sorted by algorithmic compatibility score):
${libraryDescription}

The tracks above are pre-scored using: Harmonic compatibility (40%), BPM match (25%), Energy flow (20%), Genre (10%), Recency (5%).
The "Note" field has mixing advice for each candidate.

${userPrompt ? `User preference: ${userPrompt}` : "Recommend tracks for a smooth DJ set flow."}
${playedTrackIds?.length ? `\nAlready played (${playedTrackIds.length} tracks) — excluded from candidates.` : ""}

Select up to 5 tracks. You may re-rank from the pre-scored list based on creative DJ judgment — the algorithm handles technical compatibility, but YOU handle vibe, storytelling, and flow.`,
      system: `You are an expert DJ with deep knowledge of music theory, harmonic mixing (Camelot wheel), and set building.
The candidates are pre-scored algorithmically. Your job is to apply CREATIVE judgment:
- Consider narrative flow and emotional arc of the set
- Factor in the current energy phase (${energyPhase || "unknown"}) when picking energy levels
- Explain WHY each pick works in the context of the set, not just technical compatibility
- If the algorithm's top pick isn't the best creative choice, override it and explain why
Only recommend tracks from the provided list using their exact IDs.`,
    })

    return NextResponse.json(recommendations)
  } catch (error) {
    console.error("Recommendation error:", error)
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 })
  }
}
