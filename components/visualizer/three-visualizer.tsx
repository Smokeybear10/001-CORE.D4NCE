"use client"

import { useRef, useLayoutEffect } from "react"
import type { MusicObject } from "@/lib/types"
import type { TransitionState } from "@/lib/music-engine"

interface VisualizerProps {
  analyserData: { frequency: Uint8Array; timeDomain: Uint8Array }
  musicObject: MusicObject
  transitionState?: TransitionState
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

function shiftColorTemp(color: number[], centroid: number): number[] {
  const warmth = 1 - centroid
  if (warmth > 0.55) {
    const f = (warmth - 0.55) / 0.45
    return [
      Math.min(255, Math.round(color[0] + f * 50)),
      Math.round(color[1] * (1 - f * 0.15)),
      Math.max(0, Math.round(color[2] - f * 40)),
    ]
  }
  if (warmth < 0.35) {
    const f = (0.35 - warmth) / 0.35
    return [
      Math.max(0, Math.round(color[0] - f * 35)),
      Math.min(255, Math.round(color[1] + f * 20)),
      Math.min(255, Math.round(color[2] + f * 50)),
    ]
  }
  return color
}

function pickColor(deck: "A" | "B", t: number, offset: number, centroid = 0.5): number[] {
  const arr = deck === "A" ? palette.deckA : palette.deckB
  const idx = (t * 0.04 + offset) % arr.length
  const i = Math.floor(idx)
  const frac = idx - i
  const a = arr[i % arr.length]
  const b = arr[(i + 1) % arr.length]
  return shiftColorTemp(lerpColor(a, b, frac), centroid)
}

function lerpColor(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function rgbStr(c: number[]) { return `${c[0]},${c[1]},${c[2]}` }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

// --- Data types ---

interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; life: number; maxLife: number; col: number[]
  glow: boolean
}

interface LaserBeam {
  angle: number; length: number
  life: number; maxLife: number; col: number[]
}

function spawnParticle(W: number, H: number, col: number[], energy: number, burst: boolean): Particle {
  const cx = W / 2
  const cy = H * 0.42
  const innerR = Math.min(W, H) * 0.18
  const angle = Math.random() * Math.PI * 2
  const baseSpeed = burst ? 1.0 + Math.random() * 2.0 : 0.2 + Math.random() * 0.6
  const speed = baseSpeed * (0.5 + energy * 1.5)

  return {
    x: cx + Math.cos(angle) * (innerR + Math.random() * 8),
    y: cy + Math.sin(angle) * (innerR + Math.random() * 8),
    vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 0.3,
    vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 0.3,
    size: burst ? 0.5 + Math.random() * 1.5 : 1.0 + Math.random() * 3.0,
    life: 1,
    maxLife: burst ? 20 + Math.random() * 50 : 60 + Math.random() * 140,
    col,
    glow: !burst && Math.random() < 0.3,
  }
}

// Spawn particles from screen edges during transitions
function spawnEdgeParticle(W: number, H: number, col: number[], fromLeft: boolean): Particle {
  const x = fromLeft ? -5 : W + 5
  const y = Math.random() * H * 0.8
  const speed = 1.5 + Math.random() * 2.5
  const dir = fromLeft ? 1 : -1
  return {
    x, y,
    vx: dir * speed + (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 1.5,
    size: 1.0 + Math.random() * 2.5,
    life: 1,
    maxLife: 40 + Math.random() * 80,
    col,
    glow: Math.random() < 0.4,
  }
}

// --- BACKGROUND ---

function drawBackground(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  energy: number,
  bass: number,
  kick: number,
  hat: number,
) {
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, "#0d0221")
  grad.addColorStop(0.28, "#150535")
  grad.addColorStop(0.46, "#2a0845")
  grad.addColorStop(0.53, "#5c1078")
  grad.addColorStop(0.57, "#0d0221")
  grad.addColorStop(1, "#0d0221")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const horizonY = H * 0.55
  const baseSunR = Math.min(W, H) * 0.13
  const sunR = baseSunR * (1 + bass * 0.35 + kick * 0.2)
  const sunCX = W / 2

  const sunGlow = ctx.createRadialGradient(sunCX, horizonY, sunR * 0.3, sunCX, horizonY, sunR * 3.5)
  const glowI = 0.15 + bass * 0.3 + kick * 0.15
  sunGlow.addColorStop(0, `rgba(249,171,83,${glowI})`)
  sunGlow.addColorStop(0.4, `rgba(246,46,151,${glowI * 0.4})`)
  sunGlow.addColorStop(1, "rgba(246,46,151,0)")
  ctx.fillStyle = sunGlow
  ctx.fillRect(0, 0, W, H)

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
  ctx.restore()

  // Scrolling grid
  const gridTop = horizonY
  const gridH = H - gridTop
  const scrollSpeed = 0.4 + bass * 2.5 + kick * 1.0
  const scrollOffset = (t * scrollSpeed) % 1
  const warpAmp = bass * 12 + kick * 6
  const warpFreq = 3 + energy * 4

  const numH = 24
  for (let i = 0; i < numH; i++) {
    const rawP = (i + scrollOffset) / numH
    const p = Math.pow(rawP, 2.2)
    const y = gridTop + gridH * p
    if (y <= gridTop) continue
    const alpha = (0.02 + p * 0.08) * (1 + energy * 1.5 + kick * 1.0)
    ctx.strokeStyle = `rgba(1,205,254,${Math.min(alpha, 0.25)})`
    ctx.lineWidth = 0.5 + p * 0.8 + kick * 0.6

    ctx.beginPath()
    const segments = 40
    for (let s = 0; s <= segments; s++) {
      const sx = (s / segments) * W
      const warp = Math.sin(sx * warpFreq * 0.01 + t * 2) * warpAmp * p
      if (s === 0) ctx.moveTo(sx, y + warp)
      else ctx.lineTo(sx, y + warp)
    }
    ctx.stroke()
  }

  const numV = 36
  const vanishX = W / 2
  for (let i = -numV / 2; i <= numV / 2; i++) {
    if (i === 0) continue
    const spread = W * 1.8
    const bottomX = vanishX + (i / (numV / 2)) * (spread / 2)
    const alpha = (0.01 + Math.max(0, 0.04 - Math.abs(i) * 0.001)) * (1 + energy * 0.8 + kick * 0.4)
    ctx.strokeStyle = `rgba(1,205,254,${Math.min(alpha, 0.12)})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(vanishX, gridTop)
    ctx.lineTo(bottomX, H)
    ctx.stroke()
  }

  // Horizon glow
  const horizGlow = ctx.createLinearGradient(0, horizonY - 3, 0, horizonY + 3)
  horizGlow.addColorStop(0, "rgba(246,46,151,0)")
  horizGlow.addColorStop(0.5, `rgba(246,46,151,${0.25 + bass * 0.5 + kick * 0.35})`)
  horizGlow.addColorStop(1, "rgba(246,46,151,0)")
  ctx.fillStyle = horizGlow
  const glowH = 6 + kick * 16 + bass * 10
  ctx.fillRect(0, horizonY - glowH / 2, W, glowH)

  // Stars
  const starSeed = 42
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 7919 + starSeed) % 1000) / 1000 * W
    const sy = ((i * 6271 + starSeed) % 1000) / 1000 * horizonY * 0.85
    const flickerSpeed = 0.8 + hat * 4 + energy * 2
    const flicker = 0.3 + Math.sin(t * flickerSpeed + i * 1.7) * (0.15 + hat * 0.2 + energy * 0.1)
    const size = ((i * 3571 + starSeed) % 100) / 100 * 1.2 + 0.3
    ctx.fillStyle = `rgba(185,103,255,${flicker})`
    ctx.beginPath()
    ctx.arc(sx, sy, size, 0, Math.PI * 2)
    ctx.fill()
  }
}

// --- LASER BEAMS (snare-triggered) ---

function drawLaserBeams(
  ctx: CanvasRenderingContext2D,
  beams: LaserBeam[],
  W: number, H: number,
) {
  const sunCX = W / 2
  const horizonY = H * 0.55

  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]
    b.life--
    if (b.life <= 0) { beams.splice(i, 1); continue }

    const lifeRatio = b.life / b.maxLife
    const alpha = lifeRatio * 0.35
    const endX = sunCX + Math.cos(b.angle) * b.length
    const endY = horizonY + Math.sin(b.angle) * b.length

    ctx.strokeStyle = `rgba(${rgbStr(b.col)},${alpha * 0.25})`
    ctx.lineWidth = 5 + lifeRatio * 8
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(sunCX, horizonY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    ctx.strokeStyle = `rgba(${rgbStr(b.col)},${alpha})`
    ctx.lineWidth = 1 + lifeRatio * 2.5
    ctx.beginPath()
    ctx.moveTo(sunCX, horizonY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
  }
}

// --- CIRCULAR (beat-only, subtle) ---

function drawCircular(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  W: number, H: number,
  sensitivity: number,
  smoothed: Float32Array,
  t: number,
  crossfader: number,
  circleVis: number,
  kick: number,
  centroid: number,
) {
  if (circleVis < 0.01) return

  ctx.save()
  ctx.globalAlpha = circleVis

  const cx = W / 2
  const cy = H * 0.5
  const count = 64
  const innerR = Math.min(W, H) * 0.16
  const maxBarH = Math.min(W, H) * 0.22

  for (let i = 0; i < count; i++) {
    const fi = Math.floor((i / count) * freq.length * 0.8)
    const target = (freq[fi] ?? 0) / 255 * sensitivity
    smoothed[i] = lerp(smoothed[i] ?? 0, target, 0.2)

    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const bh = smoothed[i] * maxBarH * (1 + kick * 0.3)
    const p = i / count

    const deckBlend = lerp(p, 1 - p, crossfader * 0.6 + 0.2)
    const colA = pickColor("A", t, p * 2, centroid)
    const colB = pickColor("B", t, p * 2, centroid)
    const segCol = lerpColor(colA, colB, deckBlend)

    const x1 = cx + Math.cos(angle) * innerR
    const y1 = cy + Math.sin(angle) * innerR
    const x2 = cx + Math.cos(angle) * (innerR + bh)
    const y2 = cy + Math.sin(angle) * (innerR + bh)

    const alpha = 0.2 + smoothed[i] * 0.3
    ctx.strokeStyle = `rgba(${rgbStr(segCol)},${Math.min(0.5, alpha)})`
    ctx.lineWidth = (W / count) * 0.35
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  ctx.restore()
}

// --- WAVEFORM ---

function drawWave(
  ctx: CanvasRenderingContext2D,
  timeDomain: Uint8Array,
  freq: Uint8Array,
  W: number, H: number,
  sensitivity: number,
  t: number,
  crossfader: number,
  energy: number,
  bass: number,
  centroid: number,
) {
  const mid = H * 0.42
  const silent = timeDomain.every(v => Math.abs(v - 128) < 2)

  if (!silent) {
    const count = 80
    for (let i = 0; i < count; i++) {
      const fi = Math.floor((i / count) * freq.length * 0.7)
      const v = (freq[fi] ?? 0) / 255 * sensitivity
      const bh = v * H * 0.25 * (1 + bass * 0.3)
      const x = (i / count) * W
      const bw = W / count
      const barCol = pickColor(i < count / 2 ? "A" : "B", t, i * 0.1, centroid)
      ctx.fillStyle = `rgba(${rgbStr(barCol)},${v * 0.08})`
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

  const glowCol = pickColor(crossfader > 0.5 ? "B" : "A", t, 0, centroid)
  ctx.beginPath()
  ctx.lineWidth = silent ? 3 : 2.5 + energy * 1.5
  ctx.strokeStyle = `rgba(${rgbStr(glowCol)},${silent ? 0.06 : 0.12 + bass * 0.08})`
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (let i = 0; i < len; i++) {
    const x = i * sliceW
    i === 0 ? ctx.moveTo(x, getY(i, len)) : ctx.lineTo(x, getY(i, len))
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.lineWidth = (silent ? 1.5 : 1.2) + energy * 1.5
  const leftCol = pickColor("A", t, 0, centroid)
  const midCol = pickColor(crossfader > 0.5 ? "B" : "A", t, 1, centroid)
  const rightCol = pickColor("B", t, 0, centroid)
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

// --- PARTICLES ---

function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  crossfader: number,
  energy: number,
  kick: number,
  W: number, H: number,
  t: number,
  centroid: number,
  transitionBoost: number,
) {
  if (energy < 0.02 && particles.length === 0) return

  const cx = W / 2
  const cy = H * 0.42

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life--
    if (p.life <= 0) { particles.splice(i, 1); continue }

    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    const tangentX = -dy / dist
    const tangentY = dx / dist
    const swirl = 0.12 + energy * 0.4

    p.vx += tangentX * swirl * 0.06 + (Math.random() - 0.5) * 0.03
    p.vy += tangentY * swirl * 0.06 + (Math.random() - 0.5) * 0.03
    p.vx += (dx / dist) * (0.02 + energy * 0.06)
    p.vy += (dy / dist) * (0.02 + energy * 0.06)
    p.vx *= 0.97
    p.vy *= 0.97
    p.x += p.vx
    p.y += p.vy

    const lifeRatio = p.life / p.maxLife
    const alpha = lifeRatio * (0.12 + energy * 0.25) * Math.min(1, (1 - lifeRatio) * 5)

    if (p.glow) {
      const glowSize = p.size * 3
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
      grad.addColorStop(0, `rgba(${rgbStr(p.col)},${alpha * 0.4})`)
      grad.addColorStop(1, `rgba(${rgbStr(p.col)},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = `rgba(${rgbStr(p.col)},${alpha})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * (0.3 + lifeRatio * 0.7), 0, Math.PI * 2)
    ctx.fill()
  }

  // Spawn rate boosted during transitions
  const spawnMult = 1 + transitionBoost * 2
  if (energy > 0.03) {
    const spawnCount = Math.floor((energy * energy * 8 + 0.5) * spawnMult)
    for (let i = 0; i < spawnCount; i++) {
      const deck: "A" | "B" = Math.random() < crossfader ? "B" : "A"
      const col = pickColor(deck, t, Math.random() * 3, centroid)
      particles.push(spawnParticle(W, H, col, energy, false))
    }
  }

  if (kick > 0.5) {
    const burstCount = Math.floor((8 + kick * 6) * spawnMult)
    for (let i = 0; i < burstCount; i++) {
      const deck: "A" | "B" = Math.random() < crossfader ? "B" : "A"
      const col = pickColor(deck, t, Math.random() * 3, centroid)
      particles.push(spawnParticle(W, H, col, energy, true))
    }
  }

  // During transitions, spawn edge particles (both deck colors streaming in)
  if (transitionBoost > 0.1) {
    const edgeCount = Math.floor(transitionBoost * 3)
    for (let i = 0; i < edgeCount; i++) {
      const colA = pickColor("A", t, Math.random() * 3, centroid)
      const colB = pickColor("B", t, Math.random() * 3, centroid)
      particles.push(spawnEdgeParticle(W, H, colA, true))
      particles.push(spawnEdgeParticle(W, H, colB, false))
    }
  }

  const maxParticles = 400 + Math.floor(transitionBoost * 200)
  if (particles.length > maxParticles) {
    particles.splice(0, particles.length - maxParticles)
  }
}

// --- TRANSITION EFFECTS ---

function drawTransitionEffects(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  crossfader: number,
  progress: number,
  centroid: number,
  energy: number,
) {
  // Clash intensity peaks when crossfader near 0.5 (both decks audible)
  const clashIntensity = 1 - Math.abs(crossfader - 0.5) * 2
  // Mid-transition is most intense
  const midIntensity = 1 - Math.abs(progress - 0.5) * 2

  const colA = pickColor("A", t, 0, centroid)
  const colB = pickColor("B", t, 0, centroid)
  const splitX = crossfader * W

  // 1. Deck color wash — A on left, B on right, fading toward center
  const washAlpha = clashIntensity * 0.07 + midIntensity * 0.03
  const gradA = ctx.createLinearGradient(0, 0, splitX + W * 0.1, 0)
  gradA.addColorStop(0, `rgba(${rgbStr(colA)},${washAlpha})`)
  gradA.addColorStop(1, `rgba(${rgbStr(colA)},0)`)
  ctx.fillStyle = gradA
  ctx.fillRect(0, 0, splitX + W * 0.1, H)

  const gradB = ctx.createLinearGradient(splitX - W * 0.1, 0, W, 0)
  gradB.addColorStop(0, `rgba(${rgbStr(colB)},0)`)
  gradB.addColorStop(1, `rgba(${rgbStr(colB)},${washAlpha})`)
  ctx.fillStyle = gradB
  ctx.fillRect(splitX - W * 0.1, 0, W - splitX + W * 0.1, H)

  // 2. Horizontal energy ripples — pulsing waves across the screen
  if (midIntensity > 0.2) {
    for (let r = 0; r < 3; r++) {
      const rippleY = H * (0.2 + r * 0.25 + Math.sin(t * 1.5 + r * 2) * 0.08)
      const rippleAlpha = midIntensity * 0.04 * (1 + energy * 0.5)
      const rCol = r % 2 === 0 ? colA : colB
      const ripGrad = ctx.createLinearGradient(0, rippleY - 25, 0, rippleY + 25)
      ripGrad.addColorStop(0, `rgba(${rgbStr(rCol)},0)`)
      ripGrad.addColorStop(0.5, `rgba(${rgbStr(rCol)},${rippleAlpha})`)
      ripGrad.addColorStop(1, `rgba(${rgbStr(rCol)},0)`)
      ctx.fillStyle = ripGrad
      ctx.fillRect(0, rippleY - 25, W, 50)
    }
  }

}

// --- POST EFFECTS ---

function drawPostEffects(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  energy: number,
  bass: number,
  flash: number,
  flashCol: number[],
) {
  // Scanlines
  if (energy > 0.05) {
    const alpha = Math.min(0.05, energy * 0.06)
    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1)
    }

    const scanY = ((t * 60 + energy * 180) % (H + 80)) - 40
    const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30)
    scanGrad.addColorStop(0, "rgba(255,255,255,0)")
    scanGrad.addColorStop(0.5, `rgba(255,255,255,${energy * 0.03})`)
    scanGrad.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = scanGrad
    ctx.fillRect(0, scanY - 30, W, 60)
  }

  // Vignette
  const vignetteStrength = 0.3 + bass * 0.4
  const vigGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7)
  vigGrad.addColorStop(0, "rgba(0,0,0,0)")
  vigGrad.addColorStop(1, `rgba(0,0,0,${vignetteStrength})`)
  ctx.fillStyle = vigGrad
  ctx.fillRect(0, 0, W, H)

  // Colored beat flash
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(${rgbStr(flashCol)},${flash * 0.12})`
    ctx.fillRect(0, 0, W, H)
  }
}


export function ThreeVisualizer({ analyserData, musicObject, transitionState }: VisualizerProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const smoothedRef = useRef(new Float32Array(512))
  const animRef = useRef<number>(0)
  const dataRef = useRef(analyserData)
  const objRef = useRef(musicObject)
  const transRef = useRef(transitionState)
  const particlesRef = useRef<Particle[]>([])
  const laserBeamsRef = useRef<LaserBeam[]>([])

  // Core analysis
  const energyRef = useRef(0)
  const prevEnergyRef = useRef(0)
  const avgEnergyRef = useRef(0)
  const modeBlendRef = useRef(0)

  // Multi-band energy
  const bassRef = useRef(0)
  const highRef = useRef(0)

  // Multi-band beat detection
  const kickRef = useRef(0)
  const snareRef = useRef(0)
  const hatRef = useRef(0)
  const kickAvgRef = useRef(0)
  const snareAvgRef = useRef(0)
  const hatAvgRef = useRef(0)

  // Circle visibility (beat-only)
  const circleVisRef = useRef(0)

  // Effects
  const flashRef = useRef(0)
  const shakeRef = useRef({ x: 0, y: 0 })
  const centroidRef = useRef(0.5)

  // Transition tracking
  const wasTransitionRef = useRef(false)

  dataRef.current = analyserData
  objRef.current = musicObject
  transRef.current = transitionState

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Offscreen canvas for waveform trail/footprint effect
    if (!trailCanvasRef.current) {
      trailCanvasRef.current = document.createElement("canvas")
    }
    const trailCanvas = trailCanvasRef.current
    const trailCtx = trailCanvas.getContext("2d")!

    let cachedW = wrap.clientWidth
    let cachedH = wrap.clientHeight

    const resize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      if (w < 1 || h < 1) return
      cachedW = w
      cachedH = h
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      trailCanvas.width = Math.round(w * dpr)
      trailCanvas.height = Math.round(h * dpr)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      trailCtx.setTransform(1, 0, 0, 1, 0, 0)
      trailCtx.scale(dpr, dpr)
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap)
    resize()
    window.addEventListener("resize", resize)

    const startTime = performance.now()

    const draw = () => {
      const W = cachedW
      const H = cachedH
      const { frequency, timeDomain } = dataRef.current
      const { visualSensitivity, crossfader } = objRef.current
      const trans = transRef.current
      const s = visualSensitivity ?? 0.7
      const t = (performance.now() - startTime) / 1000
      const cf = crossfader ?? 0.5

      const isTransitioning = trans?.isActive ?? false
      const transProgress = trans?.progress ?? 0
      // 0-1 intensity: peaks mid-transition
      const transBoost = isTransitioning ? (1 - Math.abs(transProgress - 0.5) * 2) : 0

      // --- Transition end detection (finale burst) ---
      if (wasTransitionRef.current && !isTransitioning) {
        flashRef.current = 1.0
        // Burst of particles from both edges
        for (let i = 0; i < 20; i++) {
          const col = pickColor(i % 2 === 0 ? "A" : "B", t, Math.random() * 3, centroidRef.current)
          particlesRef.current.push(spawnEdgeParticle(W, H, col, i % 2 === 0))
        }
      }
      wasTransitionRef.current = isTransitioning

      // --- Multi-band frequency analysis ---
      const len = Math.min(frequency.length, 1024)
      const binWidth = 22050 / len
      const kickEnd = Math.min(len, Math.floor(150 / binWidth))
      const snareEnd = Math.min(len, Math.floor(2000 / binWidth))
      const hatStart = Math.min(len, Math.floor(6000 / binWidth))

      let totalE = 0, bassE = 0, midE = 0, highE = 0, weightedSum = 0
      for (let i = 0; i < len; i++) {
        const v = frequency[i] / 255
        totalE += v
        weightedSum += v * i
        if (i < kickEnd) bassE += v
        else if (i < snareEnd) midE += v
        else if (i >= hatStart) highE += v
      }
      totalE /= len
      bassE /= kickEnd || 1
      midE /= (snareEnd - kickEnd) || 1
      highE /= (len - hatStart) || 1

      prevEnergyRef.current = energyRef.current
      energyRef.current = lerp(energyRef.current, totalE, 0.12)
      avgEnergyRef.current = lerp(avgEnergyRef.current, totalE, 0.015)
      bassRef.current = lerp(bassRef.current, bassE, 0.15)
      highRef.current = lerp(highRef.current, highE, 0.12)

      const rawCentroid = totalE > 0.01 ? weightedSum / (totalE * len) / len : 0.5
      centroidRef.current = lerp(centroidRef.current, rawCentroid, 0.08)

      // --- Multi-band beat detection ---
      kickAvgRef.current = lerp(kickAvgRef.current, bassE, 0.06)
      if (bassE > kickAvgRef.current * 1.4 && bassE > 0.15) {
        kickRef.current = Math.min(1, 0.5 + bassE * 0.5)
      } else {
        kickRef.current *= 0.88
      }

      snareAvgRef.current = lerp(snareAvgRef.current, midE, 0.07)
      if (midE > snareAvgRef.current * 1.3 && midE > 0.1) {
        snareRef.current = Math.min(1, 0.4 + midE * 0.5)
      } else {
        snareRef.current *= 0.9
      }

      hatAvgRef.current = lerp(hatAvgRef.current, highE, 0.08)
      if (highE > hatAvgRef.current * 1.3 && highE > 0.08) {
        hatRef.current = Math.min(1, 0.3 + highE * 0.5)
      } else {
        hatRef.current *= 0.92
      }

      // --- Circle visibility ---
      if (kickRef.current > 0.4) {
        circleVisRef.current = Math.min(0.4, 0.25 + kickRef.current * 0.15)
      } else {
        circleVisRef.current *= 0.94
      }

      // --- Flash & shake (boosted during transitions) ---
      const shakeBoost = 1 + transBoost * 1.5
      if (kickRef.current > 0.6) {
        flashRef.current = Math.min(1, kickRef.current * (0.8 + transBoost * 0.4))
        shakeRef.current = {
          x: (Math.random() - 0.5) * kickRef.current * 8 * shakeBoost,
          y: (Math.random() - 0.5) * kickRef.current * 5 * shakeBoost,
        }
      } else {
        flashRef.current *= 0.85
        shakeRef.current.x *= 0.8
        shakeRef.current.y *= 0.8
      }

      // --- Spawn laser beams on snare (more during transitions) ---
      const beamLimit = isTransitioning ? 12 : 8
      if (snareRef.current > 0.4 && laserBeamsRef.current.length < beamLimit) {
        const beamCount = 2 + Math.floor(snareRef.current * 3) + (isTransitioning ? 2 : 0)
        for (let i = 0; i < beamCount; i++) {
          const angle = -Math.PI * (0.1 + Math.random() * 0.8)
          const beamDeck = isTransitioning
            ? (i % 2 === 0 ? "A" : "B")
            : (Math.random() < 0.5 ? "A" : "B")
          const col = pickColor(beamDeck, t, Math.random() * 3, centroidRef.current)
          laserBeamsRef.current.push({
            angle,
            length: Math.max(W, H) * (0.5 + Math.random() * 0.5),
            life: 25 + Math.floor(Math.random() * 35),
            maxLife: 60,
            col,
          })
        }
      }

      // --- During transitions: periodic colored flashes ---
      if (isTransitioning && Math.sin(t * 4 + transProgress * 10) > 0.8) {
        const flashDeck: "A" | "B" = Math.sin(t * 3) > 0 ? "A" : "B"
        const fCol = pickColor(flashDeck, t, 0, centroidRef.current)
        flashRef.current = Math.max(flashRef.current, 0.3 + transBoost * 0.3)
        // Override flash color handled in post effects
        void fCol
      }

      // --- Mode blend ---
      const avgE2 = avgEnergyRef.current
      let target = 0
      if (avgE2 < 0.15) target = 0
      else if (avgE2 < 0.35) target = ((avgE2 - 0.15) / 0.2) * 0.5
      else target = 0.5 + (Math.min(avgE2, 0.7) - 0.35) / 0.35 * 0.5
      modeBlendRef.current = lerp(modeBlendRef.current, target, 0.012)

      if (W < 1 || H < 1) { animRef.current = requestAnimationFrame(draw); return }

      const energy = energyRef.current
      const bass = bassRef.current
      const kick = kickRef.current
      const hat = hatRef.current
      const blend = modeBlendRef.current
      const centroid = centroidRef.current
      const circleVis = circleVisRef.current

      // --- Camera shake ---
      ctx.save()
      ctx.translate(shakeRef.current.x, shakeRef.current.y)

      // --- Background ---
      drawBackground(ctx, W, H, t, energy, bass, kick, hat)

      // --- Laser beams ---
      drawLaserBeams(ctx, laserBeamsRef.current, W, H)

      // --- Transition effects (color wash, wipe line, ripples) ---
      if (isTransitioning) {
        drawTransitionEffects(ctx, W, H, t, cf, transProgress, centroid, energy)
      }

      // --- Waveform trail (footprint effect) ---
      trailCtx.save()
      trailCtx.setTransform(1, 0, 0, 1, 0, 0)
      trailCtx.globalCompositeOperation = "destination-out"
      trailCtx.fillStyle = `rgba(0,0,0,${0.08 + energy * 0.04})`
      trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height)
      trailCtx.restore()

      if (blend >= 0.45) {
        const trailAlpha = blend < 0.7 ? (blend - 0.45) / 0.25 : 1
        trailCtx.globalAlpha = trailAlpha * 0.4
        drawWave(trailCtx, timeDomain, frequency, W, H, s, t, cf, energy, bass, centroid)
        trailCtx.globalAlpha = 1
      }

      // Composite trail behind current waveform
      ctx.restore()
      ctx.save()
      ctx.globalAlpha = 0.35
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(trailCanvas, 0, 0)
      ctx.restore()
      ctx.save()
      ctx.translate(shakeRef.current.x, shakeRef.current.y)

      // --- Visualization modes ---
      if (blend < 0.45) {
        drawCircular(ctx, frequency, W, H, s, smoothedRef.current, t, cf, circleVis, kick, centroid)
      } else if (blend < 0.7) {
        const waveStrength = (blend - 0.45) / 0.25
        ctx.globalAlpha = 1 - waveStrength
        drawCircular(ctx, frequency, W, H, s, smoothedRef.current, t, cf, circleVis, kick, centroid)
        ctx.globalAlpha = waveStrength
        drawWave(ctx, timeDomain, frequency, W, H, s, t, cf, energy, bass, centroid)
        ctx.globalAlpha = 1
      } else {
        drawWave(ctx, timeDomain, frequency, W, H, s, t, cf, energy, bass, centroid)
      }

      // --- Particles ---
      updateAndDrawParticles(ctx, particlesRef.current, cf, energy, kick, W, H, t, centroid, transBoost)

      ctx.restore()

      // --- Post effects (no shake) ---
      const flashCol = pickColor(cf > 0.5 ? "B" : "A", t, 0, centroid)
      drawPostEffects(ctx, W, H, t, energy, bass, flashRef.current, flashCol)

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
