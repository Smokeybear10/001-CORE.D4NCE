"use client"

import type { MusicObject } from "@/lib/types"
import { Disc3, Sparkles, HelpCircle, Library } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopBarProps {
  musicObject: MusicObject
  onModeChange: (mode: MusicObject["visualizerMode"]) => void
  onColorSchemeChange: (scheme: MusicObject["colorScheme"]) => void
  aiOpen: boolean
  onToggleAI: () => void
  libraryOpen: boolean
  onToggleLibrary: () => void
  onShowHelp: () => void
}

export function TopBar({
  aiOpen,
  onToggleAI,
  libraryOpen,
  onToggleLibrary,
  onShowHelp,
}: TopBarProps) {
  return (
    <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      <div className="flex items-center gap-2.5">
        <Disc3 className="h-5 w-5 shrink-0 animate-[spin_4s_linear_infinite] text-fuchsia-400/80 drop-shadow-[0_0_10px_rgba(246,46,151,0.5)]" />
        <h1 className="font-mono text-[13px] font-bold uppercase tracking-[0.25em] text-fuchsia-400/90 neon-pink">
          D4NCE
        </h1>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onToggleLibrary}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            libraryOpen
              ? "text-violet-300/60"
              : "text-violet-300/25 hover:text-violet-300/50",
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
              ? "text-fuchsia-400/80 shadow-[0_0_12px_rgba(246,46,151,0.3)]"
              : "text-violet-300/25 hover:text-violet-300/50",
          )}
          title="AI Copilot"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onShowHelp}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-300/25 hover:text-violet-300/50 transition-all"
          title="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
