"use client"

import type { MusicObject } from "@/lib/types"
import { Disc3, Sparkles, HelpCircle, Library, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopBarProps {
  musicObject: MusicObject
  onModeChange: (mode: MusicObject["visualizerMode"]) => void
  onColorSchemeChange: (scheme: MusicObject["colorScheme"]) => void
  aiOpen: boolean
  onToggleAI: () => void
  libraryOpen: boolean
  onToggleLibrary: () => void
  mixerOpen: boolean
  onToggleMixer: () => void
  onShowHelp: () => void
}

export function TopBar({
  aiOpen,
  onToggleAI,
  libraryOpen,
  onToggleLibrary,
  mixerOpen,
  onToggleMixer,
  onShowHelp,
}: TopBarProps) {
  return (
    <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      <div className="flex items-center gap-2.5">
        <Disc3 className="h-6 w-6 shrink-0 text-fuchsia-400/80 drop-shadow-[0_0_10px_rgba(246,46,151,0.4)]" />
        <div className="flex flex-col leading-none">
          <h1
            className="font-mono text-[15px] sm:text-[17px] font-bold uppercase tracking-[0.25em] text-fuchsia-400/90"
          >
            D4NCE
          </h1>
          <span className="mt-0.5 text-[9px] font-medium tracking-[0.05em] text-violet-300/30">by Thomas Ou</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onToggleMixer}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            mixerOpen
              ? "text-amber-400/70"
              : "text-violet-300/35 hover:text-violet-300/60",
          )}
          title="Mixer"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleLibrary}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            libraryOpen
              ? "text-cyan-400/70"
              : "text-violet-300/35 hover:text-violet-300/60",
          )}
          title="Library"
        >
          <Library className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleAI}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            aiOpen
              ? "text-fuchsia-400/70"
              : "text-violet-300/35 hover:text-violet-300/60",
          )}
          title="AI Copilot"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onShowHelp}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-300/35 hover:text-violet-300/60 transition-all"
          title="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
