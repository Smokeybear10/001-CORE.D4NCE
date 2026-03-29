import { generateObject } from "ai"
import { xai } from "@ai-sdk/xai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { addPreset } from "@/lib/music-store"
import type { Preset } from "@/lib/types"

const presetSchema = z.object({
  name: z.string().describe("Creative name for the preset"),
  description: z.string().describe("Description of the sound/vibe"),
  tempo: z.number().min(60).max(200),
  energy: z.number().min(0).max(1),
  eq: z.object({
    low: z.number().min(-12).max(12),
    mid: z.number().min(-12).max(12),
    high: z.number().min(-12).max(12),
  }),
  filter: z.object({
    type: z.enum(["lowpass", "highpass", "bandpass"]),
    cutoff: z.number().min(20).max(20000),
    q: z.number().min(0.1).max(20),
  }),
  reverbAmount: z.number().min(0).max(1),
  delayAmount: z.number().min(0).max(1),
  delayFeedback: z.number().min(0).max(0.9),
  visualizerMode: z.enum(["cymatic", "particles", "tunnel", "waveform"]),
  visualSensitivity: z.number().min(0).max(1),
  colorScheme: z.enum(["cyberpunk", "neon", "monochrome", "fire"]),
  explanation: z.string().describe("DJ coach explanation of the preset"),
})

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const { object: presetData } = await generateObject({
      model: xai("grok-3"),
      schema: presetSchema,
      prompt: `Create a DJ mixer preset based on this description:

"${prompt}"

Generate a complete preset configuration including tempo, EQ settings, filter configuration, effects amounts, and visualizer settings. The preset should capture the described vibe and be ready to use in a DJ set.`,
      system: `You are an expert sound designer and DJ. Create presets that translate vibes and descriptions into specific mixer settings. Be creative with naming and ensure settings create the described atmosphere.`,
    })

    const preset: Preset = {
      id: crypto.randomUUID(),
      name: presetData.name,
      description: presetData.description,
      musicObject: {
        tempo: presetData.tempo,
        energy: presetData.energy,
        eq: presetData.eq,
        filter: presetData.filter,
        reverbAmount: presetData.reverbAmount,
        delayAmount: presetData.delayAmount,
        delayFeedback: presetData.delayFeedback,
        visualizerMode: presetData.visualizerMode,
        visualSensitivity: presetData.visualSensitivity,
        colorScheme: presetData.colorScheme,
      },
      createdAt: new Date(),
    }

    addPreset(preset)

    return NextResponse.json({
      preset,
      explanation: presetData.explanation,
    })
  } catch (error) {
    console.error("Preset generation error:", error)
    return NextResponse.json({ error: "Failed to generate preset" }, { status: 500 })
  }
}
