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
        "z-30 flex w-full shrink-0 items-center justify-between gap-2 bg-[#110328]/90 px-3 backdrop-blur-sm sm:gap-3 sm:px-4",
        "min-h-[52px] pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:min-h-[56px]",
        "xl:grid xl:min-h-[60px] xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center xl:gap-4 xl:px-5 xl:py-0 xl:pb-[max(0.25rem,env(safe-area-inset-bottom))] xl:pt-[max(0.25rem,env(safe-area-inset-top))]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 xl:col-start-1 xl:flex-initial">
        <Disc3 className="h-5 w-5 shrink-0 text-fuchsia-400/80 sm:h-6 sm:w-6" />
        <div className="flex min-w-0 flex-col items-start gap-0 leading-none">
          <h1 className="m-0 font-mono text-xs font-bold uppercase tracking-[0.14em] text-fuchsia-400/90 sm:text-sm sm:tracking-[0.18em]">
            D4NCE
          </h1>
          <span className="mt-0.5 font-sans text-[9px] font-medium tracking-[0.05em] text-white/40 min-[380px]:text-[10.5px]">
            by Thomas Ou
          </span>
        </div>
      </div>
      <VisualizerControls
        className="hidden min-w-0 justify-center overflow-x-auto xl:col-start-2 xl:flex xl:w-auto"
        musicObject={musicObject}
        onModeChange={onModeChange}
        onColorSchemeChange={onColorSchemeChange}
      />
      <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-1 xl:col-start-3">
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
