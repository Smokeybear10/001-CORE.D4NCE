import { generateObject } from "ai"
import { xai } from "@ai-sdk/xai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { updateTrack, getTrackById } from "@/lib/music-store"

const trackAnalysisSchema = z.object({
  title: z.string().describe("The clean song title (e.g. 'Starships', 'Die Young'). Extract from filename/metadata — remove 'Official Video', 'Lyrics', file extensions, etc."),
  artist: z.string().describe("The artist name (e.g. 'Nicki Minaj', 'Kesha'). Extract from filename/metadata."),
  genre: z.string().describe("The primary genre of the track"),
  mood: z.string().describe("The overall mood/feeling of the track"),
  energy: z.number().min(0).max(1).describe("Energy level from 0 (calm) to 1 (intense)"),
  bpm: z.number().min(60).max(200).describe("Estimated BPM"),
  key: z.string().describe('Musical key (e.g., "C major", "A minor")'),
  description: z.string().describe("A short vibe description of the track"),
  tags: z.array(z.string()).describe("Relevant tags for the track"),
})

export async function POST(request: NextRequest) {
  try {
    const { trackId, title, artist, filename } = await request.json()

    if (!trackId) {
      return NextResponse.json({ error: "Track ID is required" }, { status: 400 })
    }

    const { object: analysis } = await generateObject({
      model: xai("grok-3"),
      schema: trackAnalysisSchema,
      prompt: `Analyze this music track and identify the REAL song title and artist:

Provided title: ${title || "Unknown"}
Provided artist: ${artist || "Unknown"}
Filename: ${filename || "Unknown"}

IMPORTANT: Extract the CLEAN song title and artist from the filename/metadata. Remove junk like "(Official Video)", "(Lyrics)", "feat.", file extensions, underscores, timestamps, etc. For example:
- "Kesha_-_Die_Young__Lyrics_" → title: "Die Young", artist: "Kesha"
- "Starships_-_Nicki_Minaj__Lyrics_" → title: "Starships", artist: "Nicki Minaj"
- "Major_Lazer_DJ_Snake_-_Lean_On__feat._M__" → title: "Lean On", artist: "Major Lazer & DJ Snake"

Also estimate the musical properties based on your knowledge of the song.`,
      system: `You are an expert DJ and music analyst. Your first job is to identify the REAL song title and artist name from messy filenames. Clean up the title — just the song name, nothing else. Then provide accurate musical analysis. Always respond with valid JSON matching the schema.`,
    })

    // Update the track in store
    updateTrack(trackId, {
      title: analysis.title,
      artist: analysis.artist,
      genre: analysis.genre,
      mood: analysis.mood,
      energy: analysis.energy,
      bpm: analysis.bpm,
      key: analysis.key,
      description: analysis.description,
      tags: analysis.tags,
      analyzed: true,
    })

    const updatedTrack = getTrackById(trackId)

    return NextResponse.json({
      analysis,
      track: updatedTrack,
      explanation: `Analyzed "${title}" - ${analysis.genre} track with ${analysis.mood} mood at ~${analysis.bpm} BPM`,
    })
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Failed to analyze track" }, { status: 500 })
  }
}
