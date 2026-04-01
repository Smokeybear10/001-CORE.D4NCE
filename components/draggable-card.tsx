"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { GripHorizontal, Minus, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DraggableCardProps {
  id: string
  title: string
  icon?: React.ReactNode
  defaultPosition: { x: number; y: number }
  defaultSize?: { width: number; height?: number }
  children: React.ReactNode
  onClose?: () => void
  className?: string
  accentColor?: "fuchsia" | "cyan" | "violet"
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
  id, title, icon, defaultPosition, defaultSize, children, onClose, className, accentColor = "violet",
}: DraggableCardProps) {
  const saved = getSaved(id)
  const [pos, setPos] = useState({ x: saved?.x ?? defaultPosition.x, y: saved?.y ?? defaultPosition.y })
  const [collapsed, setCollapsed] = useState(saved?.collapsed ?? false)
  const [dragging, setDragging] = useState(false)
  const [zIndex, setZIndex] = useState(topZ)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

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
    if (!dragging) setSaved(id, pos, collapsed)
  }, [id, pos, collapsed, dragging])

  const toggleCollapse = useCallback(() => {
    setCollapsed((c: boolean) => !c)
    bringToFront()
  }, [bringToFront])

  const accentBorder = {
    fuchsia: "border-fuchsia-500/20",
    cyan: "border-cyan-500/20",
    violet: "border-violet-500/[0.15]",
  }[accentColor]

  const accentDrag = {
    fuchsia: "border-fuchsia-500/30 shadow-[0_0_32px_rgba(246,46,151,0.15)]",
    cyan: "border-cyan-500/30 shadow-[0_0_32px_rgba(1,205,254,0.15)]",
    violet: "border-violet-500/25 shadow-[0_0_32px_rgba(185,103,255,0.15)]",
  }[accentColor]

  const accentTitle = {
    fuchsia: "text-fuchsia-400/50",
    cyan: "text-cyan-400/50",
    violet: "text-violet-300/40",
  }[accentColor]

  return (
    <div
      ref={cardRef}
      className={cn(
        "absolute flex flex-col rounded-[14px] overflow-hidden transition-shadow",
        "bg-[#150535]/70 backdrop-blur-[12px] border",
        dragging ? accentDrag : accentBorder,
        dragging && "select-none",
        className,
      )}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex,
        width: defaultSize?.width,
        ...(defaultSize?.height && !collapsed ? { height: defaultSize.height } : {}),
      }}
      onPointerDown={() => bringToFront()}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-2.5 h-7 shrink-0 bg-[#0d0221]/50 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onDoubleClick={toggleCollapse}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="h-2.5 w-2.5 text-violet-300/20" />
          {icon}
          <span className={cn("text-[9px] font-mono uppercase tracking-[0.15em]", accentTitle)}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex h-4 w-4 items-center justify-center text-violet-300/20 hover:text-violet-300/40 transition-colors"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-4 w-4 items-center justify-center text-violet-300/20 hover:text-violet-300/40 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  )
}
