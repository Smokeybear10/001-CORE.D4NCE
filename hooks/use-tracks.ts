"use client"

import useSWR from "swr"
import { useEffect, useCallback } from "react"
import type { Track } from "@/lib/types"

const STORAGE_KEY = "d4nce_user_tracks"

function loadUserTracks(): Track[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Track[]
    return parsed.map((t) => ({ ...t, createdAt: new Date(t.createdAt) }))
  } catch {
    return []
  }
}

function saveUserTracks(tracks: Track[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks))
  } catch {
    // storage full or unavailable
  }
}

const sampleIds = new Set([
  "sample-1", "sample-2", "sample-3", "sample-4",
  "sample-5", "sample-6", "sample-7", "sample-8",
  "sample-9", "sample-10",
])

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useTracks() {
  const { data, error, isLoading, mutate } = useSWR<{ tracks: Track[] }>("/api/tracks", fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  })

  // Merge server sample tracks with localStorage user tracks
  const serverTracks = data?.tracks || []
  const userTracks = typeof window !== "undefined" ? loadUserTracks() : []

  // Server tracks = samples, user tracks = uploads. Deduplicate by id.
  const serverIds = new Set(serverTracks.map((t) => t.id))
  const mergedTracks = [
    ...serverTracks,
    ...userTracks.filter((t) => !serverIds.has(t.id)),
  ]

  const uploadTrack = async (file: File) => {
    try {
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        throw new Error("File too large. Maximum size is 50MB.")
      }

      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/tracks/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Upload failed")
      }

      const { url } = await res.json()

      const newTrack: Track = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist",
        url,
        createdAt: new Date(),
        analyzed: false,
      }

      // Persist to localStorage
      const current = loadUserTracks()
      saveUserTracks([...current, newTrack])

      // Optimistic update — add the track to the local SWR cache immediately
      await mutate(
        (prev) => ({
          tracks: [...(prev?.tracks || []), newTrack],
        }),
        { revalidate: false },
      )

      return newTrack
    } catch (err) {
      console.error("[v0] Upload error:", err)
      throw err
    }
  }

  const deleteTrack = async (id: string, url: string) => {
    const response = await fetch("/api/tracks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, url }),
    })

    if (!response.ok) {
      throw new Error("Delete failed")
    }

    // Remove from localStorage if it's a user track
    if (!sampleIds.has(id)) {
      const current = loadUserTracks()
      saveUserTracks(current.filter((t) => t.id !== id))
    }

    await mutate(
      (prev) => ({
        tracks: (prev?.tracks || []).filter((t) => t.id !== id),
      }),
      { revalidate: false },
    )
  }

  const analyzeTrack = async (track: Track) => {
    const response = await fetch("/api/grok/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        filename: track.url.split("/").pop(),
      }),
    })

    if (!response.ok) {
      throw new Error("Analysis failed")
    }

    const result = await response.json()
    const analyzed = result.track || result.analysis

    const updates: Partial<Track> = {
      analyzed: true,
      title: analyzed?.title ?? track.title,
      artist: analyzed?.artist ?? track.artist,
      genre: analyzed?.genre ?? track.genre,
      mood: analyzed?.mood ?? track.mood,
      energy: analyzed?.energy ?? track.energy,
      bpm: analyzed?.bpm ?? track.bpm,
      key: analyzed?.key ?? track.key,
      description: analyzed?.description ?? track.description,
      tags: analyzed?.tags ?? track.tags,
    }

    // Persist analysis results for user tracks
    if (!sampleIds.has(track.id)) {
      const current = loadUserTracks()
      saveUserTracks(current.map((t) => t.id === track.id ? { ...t, ...updates } : t))
    }

    await mutate(
      (prev) => ({
        tracks: (prev?.tracks || []).map((t) =>
          t.id === track.id ? { ...t, ...updates } : t,
        ),
      }),
      { revalidate: false },
    )

    return result
  }

  const updateTrack = async (id: string, updates: Partial<Track>) => {
    const response = await fetch(`/api/tracks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error("Update failed")
    }

    // Persist for user tracks
    if (!sampleIds.has(id)) {
      const current = loadUserTracks()
      saveUserTracks(current.map((t) => t.id === id ? { ...t, ...updates } : t))
    }

    await mutate(
      (prev) => ({
        tracks: (prev?.tracks || []).map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
      }),
      { revalidate: false },
    )
  }

  return {
    tracks: mergedTracks,
    isLoading,
    error,
    uploadTrack,
    deleteTrack,
    analyzeTrack,
    updateTrack,
    refresh: mutate,
  }
}
