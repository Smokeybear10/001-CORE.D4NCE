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
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

let topZ = 50

export function DraggableCard({
  id, title, icon, defaultPosition, defaultSize, expanded, onToggle, children, className,
}: DraggableCardProps) {
  const [pos, setPos] = useState(defaultPosition)
  const [dragging, setDragging] = useState(false)
  const [zIndex, setZIndex] = useState(topZ)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  // Reset to default position when defaultPosition changes (e.g. on mount with viewport-relative values)
  useEffect(() => {
    setPos(defaultPosition)
  }, [defaultPosition.x, defaultPosition.y])

  // Keep cards in bounds on resize
  useEffect(() => {
    const onResize = () => {
      const w = defaultSize?.width ?? 200
      setPos((p) => ({
        x: clamp(p.x, 0, window.innerWidth - w),
        y: clamp(p.y, 0, window.innerHeight - 28),
      }))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [defaultSize?.width])

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

    const w = defaultSize?.width ?? 200
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStart.current.mx
      const dy = ev.clientY - dragStart.current.my
      const nx = clamp(dragStart.current.ox + dx, 0, window.innerWidth - w)
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
  }, [pos.x, pos.y, bringToFront, defaultSize?.width])

  const handleToggle = useCallback(() => {
    onToggle()
    bringToFront()
  }, [onToggle, bringToFront])

  const accentGlow = "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
  const accentGlowDrag = "shadow-[0_0_16px_rgba(185,103,255,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]"
  const accentBorder = "border-violet-400/15"
  const accentBorderDrag = "border-violet-400/30"
  const accentTitle = "text-violet-200/65"
  const titleBarHighlight = "border-t border-t-white/[0.04]"

  return (
    <div
      ref={cardRef}
      data-card-id={id}
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
        ...(defaultSize?.height && expanded ? { height: defaultSize.height, maxHeight: `calc(100dvh - ${pos.y}px - 8px)` } : {}),
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
          <GripHorizontal className="h-2.5 w-2.5 text-white/30" />
          {icon}
          <span className={cn("text-[9px] font-mono uppercase tracking-[0.15em]", accentTitle)}>
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          aria-label={expanded ? "Minimize panel" : "Expand panel"}
          className="flex h-8 w-8 items-center justify-center rounded text-white/35 hover:text-white/55 transition-colors"
        >
          {expanded ? <Minus className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
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
