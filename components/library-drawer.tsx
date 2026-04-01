"use client"

import type { Track } from "@/lib/types"
import { MusicLibrary } from "@/components/library/music-library"

interface LibraryPanelProps {
  onLoadToDeck: (track: Track, deck: "A" | "B") => void
  trackA: Track | null
  trackB: Track | null
}

export function LibraryDrawer({ onLoadToDeck, trackA, trackB }: LibraryPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-hidden">
        <MusicLibrary onLoadToDeck={onLoadToDeck} trackA={trackA} trackB={trackB} />
      </div>
    </div>
  )
}
