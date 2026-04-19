"use client"

import { useEffect, useRef } from "react"

type Intensity = "full" | "ambient" | "minimal"

export function HeroCanvas({ intensity = "full", className = "" }: { intensity?: Intensity; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0, h = 0
    let glowGrad: CanvasGradient | null = null
    let lineGrad: CanvasGradient | null = null

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      w = rect?.width ?? window.innerWidth
      h = rect?.height ?? window.innerHeight
      canvas.width = w
      canvas.height = h
      const cx = w * 0.5, cy = h * 0.5
      glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6)
      const a = intensity === "minimal" ? 0.04 : intensity === "ambient" ? 0.06 : 0.1
      glowGrad.addColorStop(0, `rgba(139,92,246,${a})`)
      glowGrad.addColorStop(0.4, `rgba(246,46,151,${a * 0.4})`)
      glowGrad.addColorStop(1, "transparent")
      lineGrad = ctx.createLinearGradient(0, 0, w, 0)
      lineGrad.addColorStop(0, "rgba(246,46,151,0.18)")
      lineGrad.addColorStop(0.5, "rgba(139,92,246,0.32)")
      lineGrad.addColorStop(1, "rgba(246,46,151,0.18)")
    }
    resize()
    window.addEventListener("resize", resize)

    const MAX_P = intensity === "minimal" ? 6 : intensity === "ambient" ? 12 : 20
    const px = new Float32Array(MAX_P)
    const py = new Float32Array(MAX_P)
    const pvx = new Float32Array(MAX_P)
    const pvy = new Float32Array(MAX_P)
    const plife = new Float32Array(MAX_P)
    const pmaxLife = new Float32Array(MAX_P)
    let pCount = 0

    let raf = 0
    const draw = (time: number) => {
      const t = time * 0.001
      const cx = w * 0.5, cy = h * 0.55

      ctx.clearRect(0, 0, w, h)

      if (glowGrad) {
        ctx.globalAlpha = 0.55 + Math.sin(t * 0.5) * 0.15
        ctx.fillStyle = glowGrad
        ctx.fillRect(0, 0, w, h)
        ctx.globalAlpha = 1
      }

      if (intensity !== "minimal") {
        const barCount = intensity === "full" ? 28 : 18
        const barW = w / barCount
        ctx.fillStyle = `rgba(160,100,240,${intensity === "full" ? 0.07 : 0.05})`
        for (let i = 0; i < barCount; i++) {
          const freq = Math.sin(t * 1.2 + i * 0.28) * 0.5 + Math.sin(t * 0.7 + i * 0.15) * 0.3
          if (freq <= 0) continue
          const amplitude = freq * h * (intensity === "full" ? 0.1 : 0.06)
          ctx.fillRect(i * barW, cy - amplitude, barW - 1, amplitude * 2)
        }
      }

      if (lineGrad && intensity !== "minimal") {
        ctx.beginPath()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = lineGrad
        for (let i = 0; i <= w; i += 8) {
          const p = i / w
          const env = 1 - (Math.abs(p - 0.5) * 2) ** 2
          const y = cy + (Math.sin(t * 1.5 + p * 14) * h * 0.03 + Math.sin(t * 0.9 + p * 7) * h * 0.02) * env
          i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y)
        }
        ctx.stroke()
      }

      if (pCount < MAX_P && Math.random() < (intensity === "full" ? 0.1 : 0.05)) {
        const i = pCount++
        px[i] = cx + (Math.random() - 0.5) * w * 0.5
        py[i] = cy + (Math.random() - 0.5) * h * 0.4
        pvx[i] = (Math.random() - 0.5) * 0.3
        pvy[i] = -(0.2 + Math.random() * 0.4)
        plife[i] = 0
        pmaxLife[i] = 120 + Math.random() * 180
      }
      ctx.fillStyle = "rgba(180,140,255,1)"
      let writeIdx = 0
      for (let i = 0; i < pCount; i++) {
        px[i] += pvx[i]; py[i] += pvy[i]; plife[i]++
        if (plife[i] > pmaxLife[i]) continue
        if (writeIdx !== i) { px[writeIdx] = px[i]; py[writeIdx] = py[i]; pvx[writeIdx] = pvx[i]; pvy[writeIdx] = pvy[i]; plife[writeIdx] = plife[i]; pmaxLife[writeIdx] = pmaxLife[i] }
        ctx.globalAlpha = (1 - plife[writeIdx] / pmaxLife[writeIdx]) * (intensity === "full" ? 0.18 : 0.12)
        ctx.fillRect(px[writeIdx] - 1, py[writeIdx] - 1, 2, 2)
        writeIdx++
      }
      pCount = writeIdx
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [intensity])

  return <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${className}`} aria-hidden />
}
