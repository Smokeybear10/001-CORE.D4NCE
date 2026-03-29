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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative mx-4 mb-[max(0.5rem,env(safe-area-inset-bottom))] max-h-[min(560px,85dvh)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.08] bg-[#0c0c1a] p-5 animate-[slideUp_300ms_ease-out] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-[0.1em] text-white/80">How to use D4NCE</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center text-white/20 transition-colors hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <ol className="space-y-4">
          {DJ_HELP_STEPS.map(({ step, title, desc }) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-500/15 bg-violet-500/10 text-[10px] font-mono text-violet-300/60">
                {step}
              </span>
              <div>
                <p className="text-[12px] font-medium leading-snug text-white/70">{title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/30">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
