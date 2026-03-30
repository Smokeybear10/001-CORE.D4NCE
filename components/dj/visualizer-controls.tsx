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
  /** Smaller controls for mobile bottom bar */
  compact?: boolean
}

const modes: { value: MusicObject["visualizerMode"]; icon: React.ReactNode; label: string }[] = [
  { value: "cymatic",   icon: <CircleDot className="h-3.5 w-3.5" />,     label: "Radial"   },
  { value: "waveform",  icon: <AudioWaveform className="h-3.5 w-3.5" />, label: "Wave"     },
  { value: "spectrum",  icon: <Activity className="h-3.5 w-3.5" />,      label: "Spectrum"  },
]

// 3 schemes — swatch shows deck A color → deck B color (the crossfade shift)
const schemes: { value: MusicObject["colorScheme"]; a: string; b: string; label: string }[] = [
  { value: "aurora",  a: "#22d3b4", b: "#e879f9", label: "Aurora"  },
  { value: "sunset",  a: "#fbbf24", b: "#f43f5e", label: "Sunset"  },
  { value: "ocean",   a: "#3b82f6", b: "#c7d2fe", label: "Ocean"   },
]

export function VisualizerControls({
  musicObject,
  onModeChange,
  onColorSchemeChange,
  className,
  compact,
}: VisualizerControlsProps) {
  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-4", compact && "gap-1.5", className)}>
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

      <div className={cn("flex items-center", compact ? "gap-1" : "gap-1.5")}>
        {schemes.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onColorSchemeChange(s.value)}
            title={s.label}
            className={cn(
              "rounded-full transition-all touch-manipulation ring-offset-[#020207]",
              compact ? "h-6 w-6 ring-offset-1" : "h-5 w-5",
              musicObject.colorScheme === s.value
                ? "scale-110 ring-1 ring-white/60 ring-offset-1"
                : "opacity-45 hover:opacity-80 active:opacity-100",
            )}
            style={{ background: `linear-gradient(135deg, ${s.a}, ${s.b})` }}
          />
        ))}
      </div>
    </div>
  )
}
