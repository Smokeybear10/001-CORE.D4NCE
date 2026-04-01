"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { GripHorizontal, Minus, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface DraggableCardProps {
  id: string
  title: string
  icon?: React.ReactNode
  defaultPosition: { x: number; y: number }
  defaultSize?: { width: number; height?: number }
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
  accentColor?: "fuchsia" | "cyan" | "violet" | "amber"
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

function getSaved(id: string) {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`d4nce-card-${id}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setSaved(id: string, pos: { x: number; y: number }, collapsed: boolean) {
  try {
    localStorage.setItem(`d4nce-card-${id}`, JSON.stringify({ x: pos.x, y: pos.y, collapsed }))
  } catch { /* ignore */ }
}

let topZ = 50

export function DraggableCard({
  id, title, icon, defaultPosition, defaultSize, expanded, onToggle, children, className, accentColor = "violet",
}: DraggableCardProps) {
  const [pos, setPos] = useState(defaultPosition)
  const [hydrated, setHydrated] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [zIndex, setZIndex] = useState(topZ)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const saved = getSaved(id)
    if (saved) setPos({ x: saved.x, y: saved.y })
    setHydrated(true)
  }, [id])

  const bringToFront = useCallback(() => {
    topZ++
    setZIndex(topZ)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    e.preventDefault()
    bringToFront()
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y }
    setDragging(true)

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStart.current.mx
      const dy = ev.clientY - dragStart.current.my
      const nx = clamp(dragStart.current.ox + dx, 0, window.innerWidth - 60)
      const ny = clamp(dragStart.current.oy + dy, 0, window.innerHeight - 28)
      setPos({ x: nx, y: ny })
    }

    const onUp = () => {
      setDragging(false)
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
    }

    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
  }, [pos.x, pos.y, bringToFront])

  // Persist position
  useEffect(() => {
    if (!dragging && hydrated) setSaved(id, pos, !expanded)
  }, [id, pos, expanded, dragging, hydrated])

  const handleToggle = useCallback(() => {
    onToggle()
    bringToFront()
  }, [onToggle, bringToFront])

  const accentGlow = {
    fuchsia: "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    cyan: "shadow-[0_0_12px_rgba(1,205,254,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]",
    violet: "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    amber: "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  }[accentColor]

  const accentGlowDrag = {
    fuchsia: "shadow-[0_0_16px_rgba(246,46,151,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]",
    cyan: "shadow-[0_0_16px_rgba(1,205,254,0.1),inset_0_1px_0_rgba(255,255,255,0.06)]",
    violet: "shadow-[0_0_16px_rgba(185,103,255,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]",
    amber: "shadow-[0_0_16px_rgba(251,191,36,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]",
  }[accentColor]

  const accentBorder = {
    fuchsia: "border-fuchsia-400/25",
    cyan: "border-cyan-400/25",
    violet: "border-violet-400/20",
    amber: "border-amber-400/25",
  }[accentColor]

  const accentBorderDrag = {
    fuchsia: "border-fuchsia-400/45",
    cyan: "border-cyan-400/45",
    violet: "border-violet-400/40",
    amber: "border-amber-400/45",
  }[accentColor]

  const accentTitle = {
    fuchsia: "text-fuchsia-300/80",
    cyan: "text-cyan-300/80",
    violet: "text-violet-200/70",
    amber: "text-amber-300/80",
  }[accentColor]

  // Title bar top-edge highlight per accent
  const titleBarHighlight = {
    fuchsia: "border-t border-t-fuchsia-400/10",
    cyan: "border-t border-t-cyan-400/10",
    violet: "border-t border-t-violet-400/8",
    amber: "border-t border-t-amber-400/10",
  }[accentColor]

  return (
    <div
      ref={cardRef}
      className={cn(
        "absolute top-0 left-0 flex flex-col rounded-[14px] overflow-hidden",
        "backdrop-blur-[14px] border will-change-transform",
        !dragging && "transition-shadow duration-200",
        dragging ? accentBorderDrag : accentBorder,
        dragging ? accentGlowDrag : accentGlow,
        dragging && "select-none",
        className,
      )}
      style={{
        transform: `translate3d(${pos.x}px,${pos.y}px,0)`,
        zIndex,
        width: defaultSize?.width,
        ...(defaultSize?.height && expanded ? { height: defaultSize.height } : {}),
        background: "linear-gradient(135deg, rgba(26,10,62,0.55) 0%, rgba(13,2,33,0.65) 100%)",
      }}
      onPointerDown={() => bringToFront()}
    >
      {/* Title bar — always draggable */}
      <div
        className={cn(
          "flex items-center justify-between px-2.5 h-7 shrink-0 select-none cursor-grab active:cursor-grabbing",
          titleBarHighlight,
        )}
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)",
        }}
        onPointerDown={onPointerDown}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="h-2.5 w-2.5 text-white/20" />
          {icon}
          <span className={cn("text-[9px] font-mono uppercase tracking-[0.15em]", accentTitle)}>
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="flex h-4 w-4 items-center justify-center text-white/25 hover:text-white/50 transition-colors"
        >
          {expanded ? <Minus className="h-2.5 w-2.5" /> : <ChevronUp className="h-2.5 w-2.5" />}
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  )
}
