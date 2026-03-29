import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { put } from "@vercel/blob"
import { addTrack } from "@/lib/music-store"

export const runtime = "nodejs"

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/webm",
  "audio/x-m4a",
])

const ALLOWED_EXTENSIONS = /\.(mp3|wav|ogg|flac|aac|m4a|webm|mp4)$/i

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_AUDIO_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.test(file.name)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: mp3, wav, ogg, flac, aac, m4a, webm" },
        { status: 400 },
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB." },
        { status: 400 },
      )
    }

    const title = file.name.replace(/\.[^/.]+$/, "")
    let url: string

    if (process.env.VERCEL) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const blob = await put(`tracks/${Date.now()}_${safeName}`, file, { access: "public" })
      url = blob.url
    } else {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const filename = `${Date.now()}_${safeName}`
      const uploadDir = join(process.cwd(), "public", "uploads")
      await mkdir(uploadDir, { recursive: true })
      await writeFile(join(uploadDir, filename), buffer)
      url = `/uploads/${filename}`
    }

    addTrack({
      id: crypto.randomUUID(),
      title,
      artist: "Unknown Artist",
      url,
      createdAt: new Date(),
      analyzed: false,
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
