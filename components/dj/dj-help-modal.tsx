"use client"

import { X } from "lucide-react"
import { DJ_HELP_STEPS } from "@/lib/dj-help-steps"

interface DjHelpModalProps {
  open: boolean
  onClose: () => void
}

export function DjHelpModal({ open, onClose }: DjHelpModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d0221]/70 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative mx-4 mb-[max(0.5rem,env(safe-area-inset-bottom))] max-h-[min(560px,85dvh)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-[#150535]/95 backdrop-blur-lg border border-violet-500/[0.15] shadow-[0_0_40px_rgba(185,103,255,0.1)] p-5 animate-[slideUp_300ms_ease-out] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-[0.1em] text-amber-200/70">How to use D4NCE</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center text-violet-300/20 transition-colors hover:text-violet-300/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <ol className="space-y-4">
          {DJ_HELP_STEPS.map(({ step, title, desc }) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 text-[10px] font-mono text-fuchsia-300/60 shadow-[0_0_8px_rgba(246,46,151,0.15)]">
                {step}
              </span>
              <div>
                <p className="text-[12px] font-medium leading-snug text-violet-100/70">{title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-violet-300/30">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
