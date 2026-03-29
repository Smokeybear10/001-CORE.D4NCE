import type { AudioSnapshot } from "./audio-analyzer"

/** A single timestamped snapshot in the rolling buffer */
interface BufferEntry {
  t: number // ms since epoch
  energy: number
  bass: number
  mid: number
  high: number
  crossfader: number
  bpmA: number | null
  bpmB: number | null
  camelotA: string | null
  camelotB: string | null
}

/** Logged event (transition, track load, etc.) */
interface ContextEvent {
  t: number
  type: "transition_start" | "transition_end" | "track_loaded" | "track_change" | "energy_shift"
  detail: string
}

/** Energy arc phase derived from recent energy trend */
export type EnergyPhase = "warmup" | "build" | "peak" | "sustain" | "cooldown" | "idle"

/**
 * Rolling 60-second audio context buffer.
 * Captures energy levels, mixer state, and events.
 * Produces a compact summary string for LLM context injection.
 */
export class AudioContextBuffer {
  private entries: BufferEntry[] = []
  private events: ContextEvent[] = []
  private readonly maxAge = 60_000 // 60 seconds
  private readonly sampleInterval = 500 // sample every 500ms
  private lastSampleTime = 0
  private lastEnergyPhase: EnergyPhase = "idle"

  /** Push a new audio snapshot + mixer state into the buffer */
  push(
    snapshot: AudioSnapshot,
    crossfader: number,
    bpmA: number | null,
    bpmB: number | null,
    camelotA: string | null,
    camelotB: string | null,
  ) {
    const now = Date.now()

    // Throttle to sampleInterval
    if (now - this.lastSampleTime < this.sampleInterval) return
    this.lastSampleTime = now

    this.entries.push({
      t: now,
      energy: snapshot.energyLevel,
      bass: snapshot.bassEnergy,
      mid: snapshot.midEnergy,
      high: snapshot.highEnergy,
      crossfader,
      bpmA,
      bpmB,
      camelotA,
      camelotB,
    })

    // Detect energy phase shifts
    const phase = this.computeEnergyPhase()
    if (phase !== this.lastEnergyPhase && this.lastEnergyPhase !== "idle") {
      this.addEvent("energy_shift", `${this.lastEnergyPhase} -> ${phase}`)
    }
    this.lastEnergyPhase = phase

    this.prune(now)
  }

  /** Log a discrete event */
  addEvent(type: ContextEvent["type"], detail: string) {
    this.events.push({ t: Date.now(), type, detail })
  }

  /** Compute current energy phase from the last 15s of data */
  private computeEnergyPhase(): EnergyPhase {
    const now = Date.now()
    const recent = this.entries.filter((e) => now - e.t < 15_000)
    if (recent.length < 5) return "idle"

    const energies = recent.map((e) => e.energy)
    const avg = energies.reduce((s, v) => s + v, 0) / energies.length

    // Compute trend: positive = rising, negative = falling
    const half = Math.floor(energies.length / 2)
    const firstHalf = energies.slice(0, half)
    const secondHalf = energies.slice(half)
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
    const trend = avgSecond - avgFirst

    if (avg < 0.15) return "idle"
    if (avg > 0.7 && Math.abs(trend) < 0.05) return "peak"
    if (avg > 0.7 && trend > 0.05) return "build"
    if (avg > 0.5 && trend > 0.08) return "build"
    if (avg > 0.4 && trend < -0.08) return "cooldown"
    if (avg > 0.3 && trend > 0.03) return "warmup"
    if (Math.abs(trend) < 0.03) return "sustain"
    if (trend > 0) return "build"
    return "cooldown"
  }

  /** Remove entries older than maxAge */
  private prune(now: number) {
    const cutoff = now - this.maxAge
    while (this.entries.length > 0 && this.entries[0].t < cutoff) {
      this.entries.shift()
    }
    while (this.events.length > 0 && this.events[0].t < cutoff) {
      this.events.shift()
    }
    // Cap at 200 entries max
    if (this.entries.length > 200) {
      this.entries = this.entries.slice(-200)
    }
  }

  /** Get current energy phase */
  get energyPhase(): EnergyPhase {
    return this.lastEnergyPhase
  }

  /** Average energy over the last N seconds */
  averageEnergy(seconds = 10): number {
    const cutoff = Date.now() - seconds * 1000
    const recent = this.entries.filter((e) => e.t >= cutoff)
    if (recent.length === 0) return 0
    return recent.reduce((s, e) => s + e.energy, 0) / recent.length
  }

  /** Energy trend: positive = rising, negative = falling */
  energyTrend(seconds = 10): number {
    const cutoff = Date.now() - seconds * 1000
    const recent = this.entries.filter((e) => e.t >= cutoff)
    if (recent.length < 4) return 0

    const half = Math.floor(recent.length / 2)
    const first = recent.slice(0, half).reduce((s, e) => s + e.energy, 0) / half
    const second = recent.slice(half).reduce((s, e) => s + e.energy, 0) / (recent.length - half)
    return second - first
  }

  /**
   * Produce a compact 3-line summary for LLM context injection.
   * Designed to be token-efficient while maximally informative.
   */
  getSummary(): string {
    if (this.entries.length === 0) return "No audio context available."

    const latest = this.entries[this.entries.length - 1]
    const avg10 = this.averageEnergy(10)
    const trend = this.energyTrend(10)
    const phase = this.lastEnergyPhase

    const trendWord = trend > 0.05 ? "rising" : trend < -0.05 ? "falling" : "stable"

    // Line 1: Current state
    const line1 = `Energy: ${(avg10 * 100).toFixed(0)}% (${trendWord}) | Phase: ${phase} | Bass: ${(latest.bass * 100).toFixed(0)}% Mid: ${(latest.mid * 100).toFixed(0)}% High: ${(latest.high * 100).toFixed(0)}%`

    // Line 2: Mixer state
    const xfPos = latest.crossfader < 0.3 ? "Deck A" : latest.crossfader > 0.7 ? "Deck B" : "blending"
    const bpmInfo = [
      latest.bpmA ? `A:${latest.bpmA.toFixed(0)}bpm` : null,
      latest.bpmB ? `B:${latest.bpmB.toFixed(0)}bpm` : null,
    ].filter(Boolean).join(" ")
    const keyInfo = [
      latest.camelotA ? `A:${latest.camelotA}` : null,
      latest.camelotB ? `B:${latest.camelotB}` : null,
    ].filter(Boolean).join(" ")
    const line2 = `Crossfader: ${xfPos} (${(latest.crossfader * 100).toFixed(0)}%) | ${bpmInfo} | Keys: ${keyInfo || "unknown"}`

    // Line 3: Recent events
    const recentEvents = this.events.slice(-3).map((e) => {
      const ago = Math.round((Date.now() - e.t) / 1000)
      return `${e.type}(${ago}s ago): ${e.detail}`
    })
    const line3 = recentEvents.length > 0 ? recentEvents.join(" | ") : "No recent events"

    return `${line1}\n${line2}\n${line3}`
  }

  /** Get structured data for API calls */
  getStructured() {
    const latest = this.entries.length > 0 ? this.entries[this.entries.length - 1] : null
    return {
      energyPhase: this.lastEnergyPhase,
      averageEnergy: this.averageEnergy(10),
      energyTrend: this.energyTrend(10),
      latestBass: latest?.bass ?? 0,
      latestMid: latest?.mid ?? 0,
      latestHigh: latest?.high ?? 0,
      crossfader: latest?.crossfader ?? 0.5,
      bpmA: latest?.bpmA ?? null,
      bpmB: latest?.bpmB ?? null,
      camelotA: latest?.camelotA ?? null,
      camelotB: latest?.camelotB ?? null,
      recentEvents: this.events.slice(-5).map((e) => ({
        type: e.type,
        detail: e.detail,
        agoSeconds: Math.round((Date.now() - e.t) / 1000),
      })),
      summary: this.getSummary(),
    }
  }
}
