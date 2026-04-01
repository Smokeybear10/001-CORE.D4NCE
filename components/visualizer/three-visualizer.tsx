"use client"

import { useRef, useLayoutEffect } from "react"
import type { MusicObject } from "@/lib/types"

interface VisualizerProps {
  analyserData: { frequency: Uint8Array; timeDomain: Uint8Array }
  musicObject: MusicObject
}

const palette = {
  deckA: [
    [246, 46, 151],
    [255, 6, 193],
    [255, 113, 206],
    [185, 103, 255],
    [148, 22, 127],
  ],
  deckB: [
    [1, 205, 254],
    [13, 253, 249],
    [5, 255, 161],
    [167, 139, 250],
    [69, 182, 254],
  ],
}

function pickColor(deck: "A" | "B", t: number, offset: number): number[] {
  const arr = deck === "A" ? palette.deckA : palette.deckB
  const idx = (t * 0.04 + offset) % arr.length
  const i = Math.floor(idx)
  const frac = idx - i
  const a = arr[i % arr.length]
  const b = arr[(i + 1) % arr.length]
  return lerpColor(a, b, frac)
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
  size: number; life: number; maxLife: number; col: number[]
}

function spawnParticle(W: number, H: number, col: number[]): Particle {
  const cx = W / 2
  const cy = H * 0.42
  const innerR = Math.min(W, H) * 0.18
  const angle = Math.random() * Math.PI * 2
  const speed = 0.2 + Math.random() * 0.6
  return {
    x: cx + Math.cos(angle) * (innerR + Math.random() * 8),
    y: cy + Math.sin(angle) * (innerR + Math.random() * 8),
    vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 0.2,
    vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 0.2,
    size: 0.8 + Math.random() * 2,
    life: 1,
    maxLife: 60 + Math.random() * 120,
    col,
  }
}

// --- VAPORWAVE BACKGROUND (scrolling grid) ---

function drawBackground(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  energy: number,
  beat: number,
) {
  // 1. Gradient sky
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, "#0d0221")
  grad.addColorStop(0.28, "#150535")
  grad.addColorStop(0.46, "#2a0845")
  grad.addColorStop(0.53, "#5c1078")
  grad.addColorStop(0.57, "#0d0221")
  grad.addColorStop(1, "#0d0221")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // 2. Retro sun
  const horizonY = H * 0.55
  const baseSunR = Math.min(W, H) * 0.13
  const sunR = baseSunR * (1 + energy * 0.06 + beat * 0.03)
  const sunCX = W / 2

  // Sun glow
  const sunGlow = ctx.createRadialGradient(sunCX, horizonY, sunR * 0.3, sunCX, horizonY, sunR * 3)
  sunGlow.addColorStop(0, `rgba(249,171,83,${0.12 + energy * 0.08})`)
  sunGlow.addColorStop(0.4, `rgba(246,46,151,${0.04 + energy * 0.03})`)
  sunGlow.addColorStop(1, "rgba(246,46,151,0)")
  ctx.fillStyle = sunGlow
  ctx.fillRect(0, 0, W, H)

  // Sun body
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, horizonY)
  ctx.clip()

  const sunGrad = ctx.createRadialGradient(sunCX, horizonY, 0, sunCX, horizonY, sunR)
  sunGrad.addColorStop(0, "rgba(255,251,150,0.95)")
  sunGrad.addColorStop(0.25, "rgba(249,171,83,0.85)")
  sunGrad.addColorStop(0.55, "rgba(246,46,151,0.65)")
  sunGrad.addColorStop(0.85, "rgba(148,22,127,0.3)")
  sunGrad.addColorStop(1, "rgba(148,22,127,0)")
  ctx.fillStyle = sunGrad
  ctx.beginPath()
  ctx.arc(sunCX, horizonY, sunR, 0, Math.PI * 2)
  ctx.fill()

  // Venetian blind cuts
  ctx.globalCompositeOperation = "destination-out"
  const numCuts = 8
  for (let i = 1; i <= numCuts; i++) {
    const cutY = horizonY - sunR + (sunR * 2 * i) / (numCuts + 1)
    const lineH = 0.8 + i * 0.7
    ctx.fillStyle = "rgba(0,0,0,0.85)"
    ctx.fillRect(sunCX - sunR - 2, cutY, sunR * 2 + 4, lineH)
  }
  ctx.globalCompositeOperation = "source-over"
  ctx.restore()

  // 3. Scrolling perspective grid floor
  const gridTop = horizonY
  const gridH = H - gridTop

  // Scrolling speed scales with energy
  const scrollSpeed = 0.3 + energy * 0.8 + beat * 0.2
  const scrollOffset = (t * scrollSpeed) % 1

  // Horizontal grid lines — scroll toward viewer
  const numH = 24
  for (let i = 0; i < numH; i++) {
    const rawP = (i + scrollOffset) / numH
    const p = Math.pow(rawP, 2.2)
    const y = gridTop + gridH * p
    if (y <= gridTop) continue
    const alpha = (0.015 + p * 0.06) * (1 + energy * 0.5 + beat * 0.3)
    ctx.strokeStyle = `rgba(1,205,254,${Math.min(alpha, 0.12)})`
    ctx.lineWidth = 0.5 + p * 0.6
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // Vertical grid lines (perspective convergence)
  const numV = 36
  const vanishX = W / 2
  for (let i = -numV / 2; i <= numV / 2; i++) {
    if (i === 0) continue
    const spread = W * 1.8
    const bottomX = vanishX + (i / (numV / 2)) * (spread / 2)
    const alpha = (0.008 + Math.max(0, 0.035 - Math.abs(i) * 0.001)) * (1 + energy * 0.4)
    ctx.strokeStyle = `rgba(1,205,254,${Math.min(alpha, 0.06)})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(vanishX, gridTop)
    ctx.lineTo(bottomX, H)
    ctx.stroke()
  }

  // Horizon glow line
  const horizGlow = ctx.createLinearGradient(0, horizonY - 3, 0, horizonY + 3)
  horizGlow.addColorStop(0, "rgba(246,46,151,0)")
  horizGlow.addColorStop(0.5, `rgba(246,46,151,${0.2 + energy * 0.2 + beat * 0.15})`)
  horizGlow.addColorStop(1, "rgba(246,46,151,0)")
  ctx.fillStyle = horizGlow
  ctx.fillRect(0, horizonY - 3, W, 6)

  // Stars — flicker more with energy
  const starSeed = 42
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 7919 + starSeed) % 1000) / 1000 * W
    const sy = ((i * 6271 + starSeed) % 1000) / 1000 * horizonY * 0.85
    const flicker = 0.3 + Math.sin(t * (0.8 + energy * 2) + i * 1.7) * (0.15 + energy * 0.1)
    const size = ((i * 3571 + starSeed) % 100) / 100 * 1.2 + 0.3
    ctx.fillStyle = `rgba(185,103,255,${flicker})`
    ctx.beginPath()
    ctx.arc(sx, sy, size, 0, Math.PI * 2)
    ctx.fill()
  }
}

// --- CIRCULAR (only when audio playing) ---

function drawCircular(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  W: number, H: number,
  sensitivity: number,
  smoothed: Float32Array,
  t: number,
  crossfader: number,
  energy: number,
  beat: number,
) {
  // Fade in based on energy — invisible when silent
  const visAlpha = Math.min(1, energy * 4)
  if (visAlpha < 0.01) return

  ctx.save()
  ctx.globalAlpha = visAlpha

  const cx = W / 2
  const cy = H * 0.42
  const count = 128
  const innerR = Math.min(W, H) * 0.18 + beat * 3
  const maxBarH = Math.min(W, H) * 0.26

  for (let i = 0; i < count; i++) {
    const fi = Math.floor((i / count) * freq.length * 0.8)
    const target = (freq[fi] ?? 0) / 255 * sensitivity
    smoothed[i] = lerp(smoothed[i] ?? 0, target, 0.18)

    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const bh = smoothed[i] * maxBarH
    const p = i / count

    const deckBlend = lerp(p, 1 - p, crossfader * 0.6 + 0.2)
    const colA = pickColor("A", t, p * 2)
    const colB = pickColor("B", t, p * 2)
    const segCol = lerpColor(colA, colB, deckBlend)

    const x1 = cx + Math.cos(angle) * innerR
    const y1 = cy + Math.sin(angle) * innerR
    const x2 = cx + Math.cos(angle) * (innerR + bh)
    const y2 = cy + Math.sin(angle) * (innerR + bh)

    const alpha = 0.35 + smoothed[i] * 0.5
    ctx.strokeStyle = `rgba(${rgbStr(segCol)},${Math.min(0.9, alpha)})`
    ctx.lineWidth = (W / count) * 0.5
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // Inner ring
  const ringCol = pickColor(crossfader > 0.5 ? "B" : "A", t, 0)
  ctx.strokeStyle = `rgba(${rgbStr(ringCol)},${0.12 + energy * 0.1})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
  ctx.stroke()

  if (beat > 0.3) {
    const glowR = innerR * 0.7
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
    grad.addColorStop(0, `rgba(${rgbStr(ringCol)},${beat * 0.06})`)
    grad.addColorStop(1, `rgba(${rgbStr(ringCol)},0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  timeDomain: Uint8Array,
  freq: Uint8Array,
  W: number, H: number,
  sensitivity: number,
  t: number,
  crossfader: number,
  energy: number,
) {
  const mid = H * 0.42
  const silent = timeDomain.every(v => Math.abs(v - 128) < 2)

  if (!silent) {
    const count = 80
    for (let i = 0; i < count; i++) {
      const fi = Math.floor((i / count) * freq.length * 0.7)
      const v = (freq[fi] ?? 0) / 255 * sensitivity
      const bh = v * H * 0.25
      const x = (i / count) * W
      const bw = W / count
      const barCol = pickColor(i < count / 2 ? "A" : "B", t, i * 0.1)
      ctx.fillStyle = `rgba(${rgbStr(barCol)},${v * 0.06})`
      ctx.fillRect(x, mid - bh * 0.5, bw, bh)
    }
  }

  const getY = (i: number, len: number): number => {
    if (silent) {
      const p = i / len
      return mid + (Math.sin(t * 0.4 + p * Math.PI * 2) * 0.12 + Math.sin(t * 0.7 + p * Math.PI * 4) * 0.06) * H * 0.25
    }
    return mid + ((timeDomain[i] ?? 128) - 128) / 128 * sensitivity * H * 0.3
  }

  const len = timeDomain.length || 256
  const sliceW = W / len

  const glowCol = pickColor(crossfader > 0.5 ? "B" : "A", t, 0)
  ctx.beginPath()
  ctx.lineWidth = silent ? 3 : 2.5
  ctx.strokeStyle = `rgba(${rgbStr(glowCol)},${silent ? 0.06 : 0.1})`
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (let i = 0; i < len; i++) {
    const x = i * sliceW
    i === 0 ? ctx.moveTo(x, getY(i, len)) : ctx.lineTo(x, getY(i, len))
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.lineWidth = (silent ? 1.5 : 1.2) + energy
  const leftCol = pickColor("A", t, 0)
  const midCol = pickColor(crossfader > 0.5 ? "B" : "A", t, 1)
  const rightCol = pickColor("B", t, 0)
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0)
  lineGrad.addColorStop(0, `rgba(${rgbStr(leftCol)},${silent ? 0.25 : 0.6})`)
  lineGrad.addColorStop(0.5, `rgba(${rgbStr(midCol)},${silent ? 0.5 : 0.85})`)
  lineGrad.addColorStop(1, `rgba(${rgbStr(rightCol)},${silent ? 0.25 : 0.6})`)
  ctx.strokeStyle = lineGrad
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (let i = 0; i < len; i++) {
    const x = i * sliceW
    i === 0 ? ctx.moveTo(x, getY(i, len)) : ctx.lineTo(x, getY(i, len))
  }
  ctx.stroke()
}


function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  crossfader: number,
  energy: number,
  beat: number,
  W: number, H: number,
  t: number,
) {
  // Only spawn/draw particles when there's audio
  if (energy < 0.02 && particles.length === 0) return

  const cx = W / 2
  const cy = H * 0.42

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
    const swirl = 0.12 + energy * 0.3

    p.vx += tangentX * swirl * 0.06 + (Math.random() - 0.5) * 0.03
    p.vy += tangentY * swirl * 0.06 + (Math.random() - 0.5) * 0.03
    p.vx += (dx / dist) * (0.015 + energy * 0.04)
    p.vy += (dy / dist) * (0.015 + energy * 0.04)
    p.vx *= 0.97
    p.vy *= 0.97
    p.x += p.vx
    p.y += p.vy

    const lifeRatio = p.life / p.maxLife
    const alpha = lifeRatio * (0.1 + energy * 0.2) * Math.min(1, (1 - lifeRatio) * 5)
    ctx.fillStyle = `rgba(${rgbStr(p.col)},${alpha})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * (0.3 + lifeRatio * 0.7), 0, Math.PI * 2)
    ctx.fill()
  }

  // Only spawn when there's energy
  if (energy > 0.03) {
    const spawnCount = Math.floor(energy * 3 + 0.3) + (beat > 0.5 ? 2 : 0)
    for (let i = 0; i < spawnCount; i++) {
      const deck: "A" | "B" = Math.random() < crossfader ? "B" : "A"
      const col = pickColor(deck, t, Math.random() * 3)
      particles.push(spawnParticle(W, H, col))
    }
  }

  if (particles.length > 200) {
    particles.splice(0, particles.length - 200)
  }
}


export function ThreeVisualizer({ analyserData, musicObject }: VisualizerProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smoothedRef = useRef(new Float32Array(512))
  const animRef = useRef<number>(0)
  const dataRef = useRef(analyserData)
  const objRef = useRef(musicObject)
  const particlesRef = useRef<Particle[]>([])
  const energyRef = useRef(0)
  const prevEnergyRef = useRef(0)
  const beatRef = useRef(0)
  const modeBlendRef = useRef(0)
  const avgEnergyRef = useRef(0)

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
      const { visualSensitivity, crossfader } = objRef.current
      const s = visualSensitivity ?? 0.7
      const t = (performance.now() - startTime) / 1000
      const cf = crossfader ?? 0.5

      // --- Energy ---
      let totalEnergy = 0
      let bassEnergy = 0
      const len = Math.min(frequency.length, 512)
      const bassEnd = Math.floor(len * 0.15)
      for (let i = 0; i < len; i++) {
        totalEnergy += frequency[i]
        if (i < bassEnd) bassEnergy += frequency[i]
      }
      totalEnergy /= len * 255
      bassEnergy /= bassEnd * 255
      prevEnergyRef.current = energyRef.current
      energyRef.current = lerp(energyRef.current, totalEnergy, 0.12)
      avgEnergyRef.current = lerp(avgEnergyRef.current, totalEnergy, 0.015)

      // --- Beat detection ---
      const delta = energyRef.current - prevEnergyRef.current
      if (delta > 0.02 || bassEnergy - prevEnergyRef.current > 0.035) {
        beatRef.current = Math.min(1, 0.6 + bassEnergy * 0.4)
      } else {
        beatRef.current *= 0.9
      }

      // --- Auto mode: circular vs wave (no spectrum) ---
      const avgE = avgEnergyRef.current
      let target = 0
      if (avgE < 0.15) target = 0
      else if (avgE < 0.35) target = ((avgE - 0.15) / 0.2) * 0.5
      else target = 0.5 + (Math.min(avgE, 0.7) - 0.35) / 0.35 * 0.5
      modeBlendRef.current = lerp(modeBlendRef.current, target, 0.012)

      if (W < 1 || H < 1) { animRef.current = requestAnimationFrame(draw); return }

      const energy = energyRef.current
      const beat = beatRef.current
      const blend = modeBlendRef.current

      // --- Draw vaporwave background (sky + sun + scrolling grid) ---
      drawBackground(ctx, W, H, t, energy, beat)

      // --- Draw active mode (circular fades in with audio, wave for higher energy) ---
      if (blend < 0.45) {
        drawCircular(ctx, frequency, W, H, s, smoothedRef.current, t, cf, energy, beat)
      } else if (blend < 0.7) {
        const waveStrength = (blend - 0.45) / 0.25
        ctx.globalAlpha = 1 - waveStrength
        drawCircular(ctx, frequency, W, H, s, smoothedRef.current, t, cf, energy, beat)
        ctx.globalAlpha = waveStrength
        drawWave(ctx, timeDomain, frequency, W, H, s, t, cf, energy)
        ctx.globalAlpha = 1
      } else {
        drawWave(ctx, timeDomain, frequency, W, H, s, t, cf, energy)
      }

      // --- Particles (only with audio) ---
      updateAndDrawParticles(ctx, particlesRef.current, cf, energy, beat, W, H, t)

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
    <div ref={wrapRef} className="absolute inset-0 min-h-0 min-w-0 bg-[#0d0221]">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
