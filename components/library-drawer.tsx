"use client"

import type { Track } from "@/lib/types"
import { MusicLibrary } from "@/components/library/music-library"
import { X } from "lucide-react"

interface LibraryPanelProps {
  open: boolean
  onClose: () => void
  onLoadToDeck: (track: Track, deck: "A" | "B") => void
  trackA: Track | null
  trackB: Track | null
}

export function LibraryDrawer({ open, onClose, onLoadToDeck, trackA, trackB }: LibraryPanelProps) {
  if (!open) return null

  return (
    <aside className="absolute right-2 top-[52px] bottom-[56px] z-25 flex w-[260px] flex-col bg-[#150535]/90 backdrop-blur-md rounded-2xl border border-violet-500/[0.12] shadow-[0_0_30px_rgba(185,103,255,0.08)]">
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-violet-300/20">Library</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center text-violet-300/10 hover:text-violet-300/25 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <MusicLibrary onLoadToDeck={onLoadToDeck} trackA={trackA} trackB={trackB} />
      </div>
    </aside>
  )
}
