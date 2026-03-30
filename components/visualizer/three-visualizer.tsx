"use client"

import { useRef, useLayoutEffect } from "react"
import type { MusicObject } from "@/lib/types"

interface VisualizerProps {
  analyserData: { frequency: Uint8Array; timeDomain: Uint8Array }
  musicObject: MusicObject
}

const colorSchemes: Record<string, { deckA: { a: number[]; b: number[]; c: number[] }; deckB: { a: number[]; b: number[]; c: number[] } }> = {
  aurora: {
    deckA: { a: [34, 211, 180], b: [74, 222, 128], c: [16, 185, 129] },
    deckB: { a: [232, 121, 249], b: [192, 80, 255], c: [168, 85, 247] },
  },
  sunset: {
    deckA: { a: [251, 191, 36], b: [251, 146, 60], c: [245, 158, 11] },
    deckB: { a: [244, 63, 94], b: [219, 39, 119], c: [190, 24, 93] },
  },
  ocean: {
    deckA: { a: [59, 130, 246], b: [34, 211, 238], c: [99, 102, 241] },
    deckB: { a: [165, 180, 252], b: [199, 210, 254], c: [224, 231, 255] },
  },
  cyberpunk: {
    deckA: { a: [100, 140, 255], b: [34, 211, 238], c: [130, 100, 255] },
    deckB: { a: [248, 113, 113], b: [251, 146, 60], c: [232, 121, 249] },
  },
  neon: {
    deckA: { a: [74, 222, 128], b: [250, 204, 21], c: [52, 211, 153] },
    deckB: { a: [249, 115, 22], b: [251, 146, 60], c: [239, 68, 68] },
  },
  monochrome: {
    deckA: { a: [226, 232, 240], b: [148, 163, 184], c: [203, 213, 225] },
    deckB: { a: [100, 116, 139], b: [71, 85, 105], c: [51, 65, 85] },
  },
  fire: {
    deckA: { a: [251, 146, 60], b: [253, 186, 36], c: [245, 158, 11] },
    deckB: { a: [248, 113, 113], b: [239, 68, 68], c: [220, 38, 38] },
  },
}

function getScheme(name: string) {
  return colorSchemes[name] ?? colorSchemes.aurora
}

function lerpColor(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function rgbStr(c: number[]) { return `${c[0]},${c[1]},${c[2]}` }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; life: number; maxLife: number; deck: "A" | "B"
}

function spawnParticle(W: number, H: number, deck: "A" | "B"): Particle {
  const cx = W / 2
  const cy = H / 2
  const innerR = Math.min(W, H) * 0.18
  const angle = Math.random() * Math.PI * 2
  const speed = 0.3 + Math.random() * 0.8
  return {
    x: cx + Math.cos(angle) * (innerR + Math.random() * 10),
    y: cy + Math.sin(angle) * (innerR + Math.random() * 10),
    vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 0.3,
    vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 0.3,
    size: 1 + Math.random() * 2.5,
    life: 1,
    maxLife: 80 + Math.random() * 140,
    deck,
  }
}

// --- DRAW MODES ---


function drawCircular(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  W: number, H: number,
  colA: number[], colB: number[], colC: number[],
  sensitivity: number,
  smoothed: Float32Array,
  t: number,
  crossfader: number
) {
  const cx = W / 2
  const cy = H / 2
  const count = 128
  const innerR = Math.min(W, H) * 0.18
  const maxBarH = Math.min(W, H) * 0.28
  const silent = freq.every(v => v < 2)


  for (let i = 0; i < count; i++) {
    const fi = Math.floor((i / count) * freq.length * 0.8)
    const idleTarget = silent
      ? (Math.sin(t * 0.6 + i * 0.12) * 0.5 + 0.5) * 0.04 + 0.01
      : 0
    const target = silent ? idleTarget : (freq[fi] ?? 0) / 255 * sensitivity
    smoothed[i] = lerp(smoothed[i] ?? 0, target, silent ? 0.04 : 0.18)

    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const bh = smoothed[i] * maxBarH
    const p = i / count

    const segBlend = lerp(p, 1 - p, crossfader * 0.6 + 0.2)
    const segCol = lerpColor(colA, colB, segBlend)

    const x1 = cx + Math.cos(angle) * innerR
    const y1 = cy + Math.sin(angle) * innerR
    const x2 = cx + Math.cos(angle) * (innerR + bh)
    const y2 = cy + Math.sin(angle) * (innerR + bh)

    ctx.strokeStyle = `rgba(${rgbStr(segCol)},${silent ? 0.25 + smoothed[i] * 2 : 0.4 + smoothed[i] * 0.6})`
    ctx.lineWidth = (W / count) * 0.55
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const ringCol = lerpColor(colA, colC, crossfader)
  ctx.strokeStyle = `rgba(${rgbStr(ringCol)},0.2)`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
  ctx.stroke()
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  timeDomain: Uint8Array,
  freq: Uint8Array,
  W: number, H: number,
  colA: number[], colB: number[], colC: number[],
  sensitivity: number,
  t: number,
  crossfader: number
) {
  const mid = H / 2
  const silent = timeDomain.every(v => Math.abs(v - 128) < 2)

  if (!silent) {
    const count = 120
    const bgCol = lerpColor(colB, colC, crossfader)
    for (let i = 0; i < count; i++) {
      const fi = Math.floor((i / count) * freq.length * 0.7)
      const v = (freq[fi] ?? 0) / 255 * sensitivity
      const bh = v * H * 0.35
      const x = (i / count) * W
      const bw = W / count
      ctx.fillStyle = `rgba(${rgbStr(bgCol)},${v * 0.12})`
      ctx.fillRect(x, mid - bh * 0.5, bw, bh)
    }
  }

  const getY = (i: number, len: number): number => {
    if (silent) {
      const p = i / len
      const wave1 = Math.sin(t * 0.4 + p * Math.PI * 2) * 0.12
      const wave2 = Math.sin(t * 0.7 + p * Math.PI * 4) * 0.06
      const wave3 = Math.sin(t * 1.1 + p * Math.PI * 6) * 0.03
      return mid + (wave1 + wave2 + wave3) * H * 0.3
    }
    const raw = ((timeDomain[i] ?? 128) - 128) / 128 * sensitivity
    return mid + raw * (H * 0.35)
  }

  const len = timeDomain.length || 256
  const sliceW = W / len

  const glowCol = lerpColor(colA, colC, crossfader)
  ctx.beginPath()
  ctx.lineWidth = silent ? 4 : 3
  ctx.strokeStyle = `rgba(${rgbStr(glowCol)},${silent ? 0.08 : 0.15})`
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (let i = 0; i < len; i++) {
    const x = i * sliceW
    const y = getY(i, len)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.lineWidth = silent ? 2 : 1.5
  const leftCol = lerpColor(colB, colC, crossfader)
  const midCol = lerpColor(colA, colC, crossfader)
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0)
  lineGrad.addColorStop(0, `rgba(${rgbStr(leftCol)},${silent ? 0.3 : 0.6})`)
  lineGrad.addColorStop(0.5, `rgba(${rgbStr(midCol)},${silent ? 0.7 : 1})`)
  lineGrad.addColorStop(1, `rgba(${rgbStr(leftCol)},${silent ? 0.3 : 0.6})`)
  ctx.strokeStyle = lineGrad
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (let i = 0; i < len; i++) {
    const x = i * sliceW
    const y = getY(i, len)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
}

// NEW: Spectrum analyzer mode — professional frequency display with peak hold
function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  W: number, H: number,
  colA: number[], colB: number[], colC: number[],
  sensitivity: number,
  smoothed: Float32Array,
  peakHold: Float32Array,
  t: number,
  crossfader: number
) {
  const count = 64
  const gap = 1.5
  const barW = (W - gap * (count + 1)) / count
  const silent = freq.every(v => v < 2)

  // Background frequency grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  ctx.lineWidth = 0.5
  for (let y = 0; y < H; y += H / 8) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  for (let i = 0; i < count; i++) {
    // Logarithmic frequency mapping (more bins for bass, fewer for treble)
    const logPos = Math.pow(i / count, 1.5)
    const fi = Math.floor(logPos * freq.length * 0.6)
    const target = silent
      ? (Math.sin(t * 0.5 + i * 0.2) * 0.5 + 0.5) * 0.03
      : (freq[fi] ?? 0) / 255 * sensitivity
    smoothed[i] = lerp(smoothed[i] ?? 0, target, silent ? 0.03 : 0.22)

    // Peak hold with decay
    if (smoothed[i] > peakHold[i]) {
      peakHold[i] = smoothed[i]
    } else {
      peakHold[i] = Math.max(0, peakHold[i] - 0.005)
    }

    const bh = smoothed[i] * H * 0.9
    const peakY = H - peakHold[i] * H * 0.9
    const x = gap + i * (barW + gap)
    const y = H - bh

    // Frequency-based coloring: bass → color A, mid → color B, high → color C
    const freqBlend = i / count
    let barCol: number[]
    if (freqBlend < 0.33) {
      barCol = lerpColor(colA, colB, freqBlend * 3)
    } else if (freqBlend < 0.66) {
      barCol = lerpColor(colB, colC, (freqBlend - 0.33) * 3)
    } else {
      barCol = lerpColor(colC, lerpColor(colA, colC, crossfader), (freqBlend - 0.66) * 3)
    }

    // Bar gradient
    const grad = ctx.createLinearGradient(x, y, x, H)
    grad.addColorStop(0, `rgba(${rgbStr(barCol)},0.95)`)
    grad.addColorStop(0.6, `rgba(${rgbStr(barCol)},0.5)`)
    grad.addColorStop(1, `rgba(${rgbStr(barCol)},0.15)`)

    ctx.fillStyle = grad
    ctx.fillRect(x, y, barW, bh)

    // Peak hold indicator
    if (peakHold[i] > 0.02) {
      ctx.fillStyle = `rgba(${rgbStr(barCol)},0.9)`
      ctx.fillRect(x, peakY - 1.5, barW, 1.5)
    }

    // Subtle glow at top of active bars
    if (smoothed[i] > 0.3) {
      ctx.shadowColor = `rgba(${rgbStr(barCol)},0.4)`
      ctx.shadowBlur = 8
      ctx.fillStyle = `rgba(${rgbStr(barCol)},0.6)`
      ctx.fillRect(x, y, barW, 2)
      ctx.shadowBlur = 0
    }
  }

  // dB scale labels
  ctx.fillStyle = "rgba(255,255,255,0.08)"
  ctx.font = "9px monospace"
  const labels = ["0dB", "-6", "-12", "-18", "-24"]
  labels.forEach((label, i) => {
    ctx.fillText(label, 4, 12 + i * (H / 5))
  })
}


function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  colA: number[], colC: number[],
  crossfader: number,
  energy: number,
  W: number, H: number,
  t: number
) {
  const cx = W / 2
  const cy = H / 2

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life--
    if (p.life <= 0) {
      particles.splice(i, 1)
      continue
    }

    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    const tangentX = -dy / dist
    const tangentY = dx / dist
    const swirl = 0.15 + energy * 0.4

    p.vx += tangentX * swirl * 0.08 + (Math.random() - 0.5) * 0.05
    p.vy += tangentY * swirl * 0.08 + (Math.random() - 0.5) * 0.05

    const outward = 0.02 + energy * 0.06
    p.vx += (dx / dist) * outward
    p.vy += (dy / dist) * outward

    p.vx *= 0.97
    p.vy *= 0.97

    p.x += p.vx
    p.y += p.vy

    const lifeRatio = p.life / p.maxLife
    const alpha = lifeRatio * (0.15 + energy * 0.35) * Math.min(1, (1 - lifeRatio) * 5)
    const col = p.deck === "A" ? colA : colC
    const blendCol = lerpColor(col, p.deck === "A" ? colC : colA, crossfader * 0.3)

    ctx.fillStyle = `rgba(${rgbStr(blendCol)},${alpha})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * (0.3 + lifeRatio * 0.7), 0, Math.PI * 2)
    ctx.fill()
  }

  const spawnCount = Math.max(1, Math.floor(energy * 5 + 0.5))
  for (let i = 0; i < spawnCount; i++) {
    const deck = Math.random() < crossfader ? "B" : "A"
    particles.push(spawnParticle(W, H, deck))
  }

  if (particles.length > 300) {
    particles.splice(0, particles.length - 300)
  }
}

export function ThreeVisualizer({ analyserData, musicObject }: VisualizerProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smoothedRef = useRef(new Float32Array(512))
  const peakHoldRef = useRef(new Float32Array(128))
  const animRef = useRef<number>(0)
  const dataRef = useRef(analyserData)
  const objRef = useRef(musicObject)
  const particlesRef = useRef<Particle[]>([])
  const energyRef = useRef(0)
  const prevEnergyRef = useRef(0)
  const beatRef = useRef(0)

  dataRef.current = analyserData
  objRef.current = musicObject

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      if (w < 1 || h < 1) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap)
    resize()
    window.addEventListener("resize", resize)

    const startTime = performance.now()

    const draw = () => {
      const W = wrap.clientWidth
      const H = wrap.clientHeight
      const { frequency, timeDomain } = dataRef.current
      const { visualizerMode, visualSensitivity, crossfader, colorScheme } = objRef.current
      const s = visualSensitivity ?? 0.7
      const t = (performance.now() - startTime) / 1000

      const cf = crossfader ?? 0.5
      const scheme = getScheme(colorScheme)
      const colA = lerpColor(scheme.deckA.a, scheme.deckB.a, cf)
      const colB = lerpColor(scheme.deckA.b, scheme.deckB.b, cf)
      const colC = lerpColor(scheme.deckA.c, scheme.deckB.c, cf)

      // Energy calculation with beat detection
      let totalEnergy = 0
      const len = Math.min(frequency.length, 512)
      for (let i = 0; i < len; i++) totalEnergy += frequency[i]
      totalEnergy = totalEnergy / (len * 255)
      prevEnergyRef.current = energyRef.current
      energyRef.current = lerp(energyRef.current, totalEnergy, 0.12)

      // Beat detection: energy spike
      if (energyRef.current - prevEnergyRef.current > 0.03) {
        beatRef.current = 1
      } else {
        beatRef.current *= 0.92
      }

      if (W < 1 || H < 1) {
        animRef.current = requestAnimationFrame(draw)
        return
      }

      // Trail fade — clears previous frame smoothly
      ctx.fillStyle = "rgba(6,6,11,0.22)"
      ctx.fillRect(0, 0, W, H)

      // Beat flash
      if (beatRef.current > 0.3) {
        const flashCol = lerpColor(colA, colC, cf)
        ctx.fillStyle = `rgba(${rgbStr(flashCol)},${beatRef.current * 0.03})`
        ctx.fillRect(0, 0, W, H)
      }

      if (visualizerMode === "waveform") {
        drawWave(ctx, timeDomain, frequency, W, H, colA, colB, colC, s, t, cf)
      } else if (visualizerMode === "spectrum") {
        drawSpectrum(ctx, frequency, W, H, colA, colB, colC, s, smoothedRef.current, peakHoldRef.current, t, cf)
      } else {
        drawCircular(ctx, frequency, W, H, colA, colB, colC, s, smoothedRef.current, t, cf)
      }

      updateAndDrawParticles(ctx, particlesRef.current, colA, colC, cf, energyRef.current, W, H, t)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0 min-h-0 min-w-0 bg-[#06060b]">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
