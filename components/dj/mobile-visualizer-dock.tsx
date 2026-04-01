"use client"

import type { MusicObject } from "@/lib/types"
import { VisualizerControls } from "@/components/dj/visualizer-controls"

interface MobileVisualizerDockProps {
  visible: boolean
  musicObject: MusicObject
  onModeChange: (mode: MusicObject["visualizerMode"]) => void
  onColorSchemeChange: (scheme: MusicObject["colorScheme"]) => void
}

export function MobileVisualizerDock({
  visible,
  musicObject,
  onModeChange,
  onColorSchemeChange,
}: MobileVisualizerDockProps) {
  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center xl:hidden"
      style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto rounded-full bg-[#150535]/90 px-2 py-1.5 shadow-[0_0_20px_rgba(185,103,255,0.08)] border border-violet-500/[0.1] backdrop-blur-sm">
        <VisualizerControls
          compact
          musicObject={musicObject}
          onModeChange={onModeChange}
          onColorSchemeChange={onColorSchemeChange}
        />
      </div>
    </div>
  )
}
