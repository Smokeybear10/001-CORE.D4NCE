"use client"

import type React from "react"
import type { MusicObject } from "@/lib/types"
import { CircleDot, AudioWaveform, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface VisualizerControlsProps {
  musicObject: MusicObject
  onModeChange: (mode: MusicObject["visualizerMode"]) => void
  onColorSchemeChange: (scheme: MusicObject["colorScheme"]) => void
  className?: string
  compact?: boolean
}

const modes: { value: MusicObject["visualizerMode"]; icon: React.ReactNode; label: string }[] = [
  { value: "cymatic",   icon: <CircleDot className="h-3.5 w-3.5" />,     label: "Radial"   },
  { value: "waveform",  icon: <AudioWaveform className="h-3.5 w-3.5" />, label: "Wave"     },
  { value: "spectrum",  icon: <Activity className="h-3.5 w-3.5" />,      label: "Spectrum"  },
]

export function VisualizerControls({
  musicObject,
  onModeChange,
  className,
  compact,
}: VisualizerControlsProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <div
        className={cn(
          "flex rounded-lg border border-white/[0.06] bg-white/[0.04] p-0.5",
          compact && "rounded-full px-0.5",
        )}
      >
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onModeChange(m.value)}
            title={m.label}
            className={cn(
              "flex items-center justify-center rounded-md transition-all touch-manipulation",
              compact ? "h-8 w-8 rounded-full" : "h-7 w-7",
              musicObject.visualizerMode === m.value
                ? "bg-white/[0.10] text-white/90"
                : "text-white/25 hover:text-white/50 active:text-white/60",
            )}
          >
            {m.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
