"use client"

import { useState, useEffect } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { DJ_HELP_STEPS } from "@/lib/dj-help-steps"

interface DjHelpModalProps {
  open: boolean
  onClose: () => void
  onOpenCard?: (cardId: string) => void
}

export function DjHelpModal({ open, onClose, onOpenCard }: DjHelpModalProps) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const current = DJ_HELP_STEPS[step]

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Open the relevant card, then measure after it expands
  useEffect(() => {
    if (!open || !current?.target) {
      setRect(null)
      return
    }
    onOpenCard?.(current.target)

    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-card-id="${current.target}"]`)
        ?? document.querySelector(`[data-tour-id="${current.target}"]`)
      setRect(el?.getBoundingClientRect() ?? null)
    }, 100)
    return () => clearTimeout(timer)
  }, [open, step, current, onOpenCard])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault()
        setStep(s => Math.min(s + 1, DJ_HELP_STEPS.length - 1))
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        setStep(s => Math.max(s - 1, 0))
      } else if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open || !current) return null
  const isLast = step === DJ_HELP_STEPS.length - 1
  const isFirst = step === 0

  // Position tooltip beside the highlighted element
  const tooltipW = 300
  const pos = (() => {
    if (!rect) return { top: "50%" as string | number, left: "50%" as string | number, transform: "translate(-50%, -50%)" }

    const spaceRight = window.innerWidth - rect.right
    const spaceLeft = rect.left
    const spaceBelow = window.innerHeight - rect.bottom
    const gap = 12

    if (spaceRight >= tooltipW + gap) {
      return { top: Math.max(8, rect.top), left: rect.right + gap }
    }
    if (spaceLeft >= tooltipW + gap) {
      return { top: Math.max(8, rect.top), left: rect.left - tooltipW - gap }
    }
    if (spaceBelow >= 160) {
      return { top: rect.bottom + gap, left: Math.max(8, Math.min(rect.left, window.innerWidth - tooltipW - 8)) }
    }
    return { top: Math.max(8, rect.top - 160), left: Math.max(8, Math.min(rect.left, window.innerWidth - tooltipW - 8)) }
  })()

  return (
    <>
      {/* Backdrop with cutout */}
      <div
        className="fixed inset-0 z-[200] bg-black/40"
        onClick={onClose}
        style={{
          transition: "clip-path 300ms ease",
          ...(rect ? {
            clipPath: `polygon(
              0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
              ${rect.left - 6}px ${rect.top - 6}px,
              ${rect.left - 6}px ${rect.bottom + 6}px,
              ${rect.right + 6}px ${rect.bottom + 6}px,
              ${rect.right + 6}px ${rect.top - 6}px,
              ${rect.left - 6}px ${rect.top - 6}px
            )`,
          } : {}),
        }}
      />

      {/* Highlight ring */}
      {rect && (
        <div
          className="fixed z-[201] rounded-xl border-2 border-violet-400/60 shadow-[0_0_30px_rgba(167,139,250,0.25)] pointer-events-none"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            transition: "top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[202] w-[300px] rounded-xl bg-[#150535]/95 backdrop-blur-lg border border-violet-500/20 shadow-[0_0_40px_rgba(185,103,255,0.15)] p-4"
        style={{
          ...pos,
          transition: "top 300ms ease, left 300ms ease, transform 300ms ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/15 text-[10px] font-mono text-violet-300/70">
              {current.step}
            </span>
            <span className="text-[10px] font-mono text-violet-300/30">
              {step + 1} / {DJ_HELP_STEPS.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center text-violet-300/20 hover:text-violet-300/60 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <h3 className="text-[12px] font-medium text-violet-100/80 mb-1">{current.title}</h3>
        <p className="text-[11px] leading-relaxed text-violet-300/40 mb-4">{current.desc}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={isFirst}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-violet-300/30 hover:text-violet-300/60 disabled:opacity-20 disabled:cursor-default transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Back
          </button>

          <div className="flex items-center gap-1">
            {DJ_HELP_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === step
                    ? "w-4 bg-violet-400/60"
                    : "w-1.5 bg-violet-400/15 hover:bg-violet-400/30"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => isLast ? onClose() : setStep(s => s + 1)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-violet-300/50 hover:text-violet-300/80 transition-colors"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </>
  )
}
