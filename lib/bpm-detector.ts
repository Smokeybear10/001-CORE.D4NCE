// BPM detection using energy envelope peak detection with harmonic filtering
export class BPMDetector {
  private sampleRate: number

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate
  }

  async detectBPM(audioBuffer: AudioBuffer): Promise<number> {
    const channelData = audioBuffer.getChannelData(0)

    // Analyze first 30 seconds max
    const analyzeLength = Math.min(audioBuffer.length, this.sampleRate * 30)
    const data = channelData.slice(0, analyzeLength)

    // Calculate energy envelope with 100ms windows, 50% overlap
    const windowSize = Math.floor(this.sampleRate / 10)
    const hopSize = Math.floor(windowSize / 2)
    const energyEnvelope: number[] = []

    for (let i = 0; i < data.length - windowSize; i += hopSize) {
      let energy = 0
      for (let j = 0; j < windowSize; j++) {
        energy += data[i + j] * data[i + j] // RMS energy (squared)
      }
      energyEnvelope.push(Math.sqrt(energy / windowSize))
    }

    // Find peaks with minimum distance between them (avoids double-triggers)
    const peaks = this.findPeaks(energyEnvelope)

    // Calculate intervals between peaks
    const intervals: number[] = []
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1])
    }

    if (intervals.length === 0) return 120

    // Find most common interval (mode) with grouping
    const intervalCounts = new Map<number, number>()
    for (const interval of intervals) {
      const rounded = Math.round(interval / 2) * 2
      intervalCounts.set(rounded, (intervalCounts.get(rounded) || 0) + 1)
    }

    let maxCount = 0
    let mostCommonInterval = 0
    intervalCounts.forEach((count, interval) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonInterval = interval
      }
    })

    // Convert interval to BPM (each hop is 50ms)
    const intervalMs = mostCommonInterval * 50
    if (intervalMs === 0) return 120

    let bpm = 60000 / intervalMs

    // Harmonic filtering: correct octave errors
    // If BPM is too low, check if doubling it has more support
    // If BPM is too high, check if halving it is more reasonable
    bpm = this.correctOctaveErrors(bpm, intervals)

    return Math.max(60, Math.min(180, Math.round(bpm)))
  }

  private correctOctaveErrors(bpm: number, intervals: number[]): number {
    // Check half and double BPM candidates
    const candidates = [bpm / 2, bpm, bpm * 2].filter(
      (b) => b >= 60 && b <= 180,
    )

    if (candidates.length <= 1) return bpm

    // Count how many intervals support each candidate
    let bestCandidate = bpm
    let bestScore = 0

    for (const candidate of candidates) {
      const expectedInterval = 60000 / candidate / 50 // Expected interval in hops
      let score = 0
      for (const interval of intervals) {
        // Check if this interval is close to the expected interval or a multiple
        const ratio = interval / expectedInterval
        const nearestInt = Math.round(ratio)
        if (nearestInt > 0 && Math.abs(ratio - nearestInt) < 0.15) {
          score++
        }
      }
      if (score > bestScore) {
        bestScore = score
        bestCandidate = candidate
      }
    }

    return bestCandidate
  }

  private findPeaks(data: number[]): number[] {
    const peaks: number[] = []
    const threshold = this.calculateThreshold(data)
    // Minimum distance between peaks: ~200ms (prevents double-triggers on snare hits)
    const minDistance = 4 // 4 hops = 200ms

    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > threshold && data[i] > data[i - 1] && data[i] > data[i + 1]) {
        // Ensure minimum distance from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i)
        }
      }
    }

    return peaks
  }

  private calculateThreshold(data: number[]): number {
    const sorted = [...data].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.7)]
  }
}
