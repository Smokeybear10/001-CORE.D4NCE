import { NextResponse } from "next/server"

// Per-IP fixed-window limiter. Lives in memory, so on serverless it's per-instance —
// a determined caller can exceed the limit by fanning out across cold starts. Good
// enough to stop a single client from looping the AI routes and draining credits.
type Window = { count: number; resetAt: number }

const globalRef = globalThis as typeof globalThis & { __rateLimits?: Map<string, Window> }
const windows = (globalRef.__rateLimits ??= new Map())

const WINDOW_MS = 60_000
const MAX_ENTRIES = 10_000

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}

export function rateLimit(request: Request, limit: number): NextResponse | null {
  const key = `${new URL(request.url).pathname}:${clientKey(request)}`
  const now = Date.now()
  const existing = windows.get(key)

  if (!existing || now >= existing.resetAt) {
    if (windows.size >= MAX_ENTRIES) {
      for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k)
    }
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }

  existing.count += 1
  if (existing.count <= limit) return null

  const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  )
}
