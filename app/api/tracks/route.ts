import { NextResponse } from "next/server"
import { getTracks, deleteTrack, addTrack } from "@/lib/music-store"
import type { Track } from "@/lib/types"

export async function GET() {
  try {
    const tracks = getTracks()
    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("Error listing tracks:", error)
    return NextResponse.json({ error: "Failed to list tracks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, artist, url } = body ?? {}

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const track: Track = {
      id: crypto.randomUUID(),
      title: title || "Unknown Track",
      artist: artist || "Unknown Artist",
      url,
      createdAt: new Date(),
      analyzed: false,
    }

    addTrack(track)
    return NextResponse.json({ track })
  } catch (error) {
    console.error("Error creating track:", error)
    return NextResponse.json({ error: "Failed to create track" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body ?? {}

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Track ID is required" }, { status: 400 })
    }

    deleteTrack(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting track:", error)
    return NextResponse.json({ error: "Failed to delete track" }, { status: 500 })
  }
}
