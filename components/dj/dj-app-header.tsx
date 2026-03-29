"use client"

import type { MusicObject } from "@/lib/types"
import { Disc3, HelpCircle, PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { VisualizerControls } from "@/components/dj/visualizer-controls"

interface DjAppHeaderProps {
  musicObject: MusicObject
  onModeChange: (mode: MusicObject["visualizerMode"]) => void
  onColorSchemeChange: (scheme: MusicObject["colorScheme"]) => void
  sidePanelOpen: boolean
  onToggleSidePanel: () => void
  onShowHelp: () => void
}

export function DjAppHeader({
  musicObject,
  onModeChange,
  onColorSchemeChange,
  sidePanelOpen,
  onToggleSidePanel,
  onShowHelp,
}: DjAppHeaderProps) {
  return (
    <header
      className={cn(
        "z-30 flex w-full shrink-0 items-center justify-between gap-2 border-b border-violet-500/15 bg-[#020207]/90 px-3 backdrop-blur-xl sm:gap-3 sm:px-4",
        "min-h-[52px] pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:min-h-[56px]",
        "lg:grid lg:min-h-[60px] lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-4 lg:px-5 lg:py-0 lg:pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:pt-[max(0.25rem,env(safe-area-inset-top))]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:col-start-1 lg:flex-initial">
        <Disc3 className="h-5 w-5 shrink-0 animate-[spin_4s_linear_infinite] text-violet-400/80 sm:h-6 sm:w-6" />
        <div className="flex min-w-0 flex-col items-start gap-0 leading-none">
          <h1 className="m-0 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text font-mono text-xs font-bold uppercase tracking-[0.14em] text-transparent sm:text-sm sm:tracking-[0.18em]">
            D4NCE
          </h1>
          <span className="mt-0.5 font-sans text-[9px] font-medium tracking-[0.05em] text-white/40 min-[380px]:text-[10.5px]">
            by Thomas Ou
          </span>
        </div>
      </div>
      <VisualizerControls
        className="hidden min-w-0 justify-center overflow-x-auto lg:col-start-2 lg:flex lg:w-auto"
        musicObject={musicObject}
        onModeChange={onModeChange}
        onColorSchemeChange={onColorSchemeChange}
      />
      <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-1 lg:col-start-3">
        <button
          type="button"
          onClick={onShowHelp}
          className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/50 active:bg-white/[0.08]"
          title="Help"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={onToggleSidePanel}
          className={cn(
            "flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg transition-all active:scale-[0.98]",
            sidePanelOpen
              ? "bg-white/[0.1] text-white/75"
              : "text-white/30 hover:bg-white/[0.06] hover:text-white/50",
          )}
          title={sidePanelOpen ? "Close panel" : "Open panel"}
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  )
}
