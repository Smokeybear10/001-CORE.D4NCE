import { type NextRequest, NextResponse } from "next/server"

const XAI_API_KEY = process.env.XAI_API_KEY
const TTS_URL = "https://api.x.ai/v1/audio/speech"

// Available voices: Ara (Female), Rex (Male), Sal, Eve (Female), Una (Female), Leo (Male)
type Voice = "Ara" | "Rex" | "Sal" | "Eve" | "Una" | "Leo"

export async function POST(request: NextRequest) {
  try {
    const { text, voice = "Ara" } = (await request.json()) as { text: string; voice?: Voice }

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    if (!XAI_API_KEY) {
      return NextResponse.json({ error: "XAI API key not configured" }, { status: 500 })
    }

    // Call XAI TTS API
    const response = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        voice: voice,
        response_format: "mp3",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("XAI TTS error:", errorText)
      return NextResponse.json({ error: "TTS API error" }, { status: response.status })
    }

    // Return audio as binary response
    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}
