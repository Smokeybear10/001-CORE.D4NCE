"use client"

import type { TransitionState } from "@/lib/music-engine"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { X, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransitionStatusProps {
  transitionState: TransitionState
  onCancel: () => void
}

export function TransitionStatus({ transitionState, onCancel }: TransitionStatusProps) {
  if (!transitionState.isActive) {
    return null
  }

  const { progress, duration, currentValues } = transitionState
  const elapsedSeconds = Math.round(progress * duration)
  const remainingSeconds = Math.round(duration - elapsedSeconds)

  return (
    <div className="p-3 rounded-lg bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30 animate-pulse-slow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-fuchsia-400 animate-pulse" />
          <span className="text-xs font-semibold text-violet-100">Transition Active</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-violet-100/40 mb-1">
          <span>{elapsedSeconds}s</span>
          <span>{Math.round(progress * 100)}%</span>
          <span>{remainingSeconds}s remaining</span>
        </div>
        <Progress value={progress * 100} className="h-2" />
      </div>

      {/* Live values */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center justify-between p-1.5 rounded bg-violet-500/[0.06]">
          <span className="text-violet-100/40">Crossfader</span>
          <span
            className={cn(
              "font-mono",
              currentValues.crossfader < 0.4 ? "text-fuchsia-400" : currentValues.crossfader > 0.6 ? "text-cyan-400" : "text-violet-100"
            )}
          >
            {currentValues.crossfader < 0.4 ? "← A" : currentValues.crossfader > 0.6 ? "B →" : "MID"}
            <span className="ml-1 text-violet-100/35">
              {Math.round(currentValues.crossfader * 100)}%
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between p-1.5 rounded bg-violet-500/[0.06]">
          <span className="text-violet-100/40">Filter</span>
          <span className="font-mono text-violet-100/55">
            {currentValues.filterCutoff >= 10000
              ? `${(currentValues.filterCutoff / 1000).toFixed(1)}kHz`
              : `${Math.round(currentValues.filterCutoff)}Hz`}
          </span>
        </div>

        <div className="flex items-center justify-between p-1.5 rounded bg-violet-500/[0.06]">
          <span className="text-violet-100/40">Reverb</span>
          <span className={cn("font-mono", currentValues.reverb > 0.3 ? "text-cyan-400" : "text-violet-100/35")}>
            {Math.round(currentValues.reverb * 100)}%
          </span>
        </div>

        <div className="flex items-center justify-between p-1.5 rounded bg-violet-500/[0.06]">
          <span className="text-violet-100/40">Delay</span>
          <span className={cn("font-mono", currentValues.delay > 0.3 ? "text-fuchsia-400" : "text-violet-100/35")}>
            {Math.round(currentValues.delay * 100)}%
          </span>
        </div>
      </div>

      {/* Visual indicator bar */}
      <div className="mt-2 flex gap-0.5 h-1">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-all duration-100",
              i < progress * 20
                ? "bg-gradient-to-r from-fuchsia-500 to-cyan-500"
                : "bg-violet-500/10"
            )}
          />
        ))}
      </div>
    </div>
  )
}
