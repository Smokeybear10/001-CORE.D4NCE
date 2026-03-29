import { type NextRequest, NextResponse } from "next/server"
import { getTrackById, updateTrack } from "@/lib/music-store"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const track = getTrackById(id)

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 })
  }

  return NextResponse.json({ track })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const updates = await request.json()

  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  const existing = getTrackById(id)
  if (!existing) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 })
  }

  updateTrack(id, updates)
  const track = getTrackById(id)

  return NextResponse.json({ track })
}
