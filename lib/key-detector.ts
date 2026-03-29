// Musical key detection using chromagram analysis + Krumhansl-Schmuckler algorithm

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

// Krumhansl-Schmuckler key profiles (correlation weights)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

// Map musical keys to Camelot notation
const KEY_TO_CAMELOT: Record<string, string> = {
  "C major": "8B", "G major": "9B", "D major": "10B", "A major": "11B",
  "E major": "12B", "B major": "1B", "F# major": "2B", "Db major": "3B",
  "Ab major": "4B", "Eb major": "5B", "Bb major": "6B", "F major": "7B",
  "A minor": "8A", "E minor": "9A", "B minor": "10A", "F# minor": "11A",
  "Db minor": "12A", "Ab minor": "1A", "Eb minor": "2A", "Bb minor": "3A",
  "F minor": "4A", "C minor": "5A", "G minor": "6A", "D minor": "7A",
}

export interface KeyResult {
  key: string           // e.g. "C major", "A minor"
  camelot: string       // e.g. "8B", "8A"
  confidence: number    // 0-1
  alternateKey: string  // second best guess
  alternateCamelot: string
}

export class KeyDetector {
  private sampleRate: number

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate
  }

  async detectKey(audioBuffer: AudioBuffer): Promise<KeyResult> {
    const channelData = audioBuffer.getChannelData(0)

    // Analyze middle section of track for most stable key signature
    const startSample = Math.floor(audioBuffer.length * 0.1)
    const endSample = Math.min(audioBuffer.length, startSample + this.sampleRate * 30)
    const data = channelData.slice(startSample, endSample)

    // Build chromagram using DFT at each pitch class frequency
    const chromagram = this.computeChromagram(data)

    // Normalize chromagram
    const max = Math.max(...chromagram)
    if (max > 0) {
      for (let i = 0; i < 12; i++) chromagram[i] /= max
    }

    // Correlate with all 24 key profiles (12 major + 12 minor)
    const scores: { key: string; score: number }[] = []

    for (let root = 0; root < 12; root++) {
      const rotatedChroma = this.rotateArray(chromagram, root)

      const majorScore = this.pearsonCorrelation(rotatedChroma, MAJOR_PROFILE)
      const minorScore = this.pearsonCorrelation(rotatedChroma, MINOR_PROFILE)

      scores.push({ key: `${NOTE_NAMES[root]} major`, score: majorScore })
      scores.push({ key: `${NOTE_NAMES[root]} minor`, score: minorScore })
    }

    scores.sort((a, b) => b.score - a.score)

    const best = scores[0]
    const second = scores[1]

    // Confidence: gap between top two scores normalized
    const scoreRange = scores[0].score - scores[scores.length - 1].score
    const confidence = scoreRange > 0
      ? Math.min(1, (best.score - second.score) / scoreRange * 3 + 0.4)
      : 0.5

    return {
      key: best.key,
      camelot: KEY_TO_CAMELOT[best.key] ?? "?",
      confidence: Math.round(confidence * 100) / 100,
      alternateKey: second.key,
      alternateCamelot: KEY_TO_CAMELOT[second.key] ?? "?",
    }
  }

  private computeChromagram(data: Float32Array): number[] {
    const chromagram = new Array(12).fill(0)
    const windowSize = 4096
    const hopSize = 2048
    const numWindows = Math.floor((data.length - windowSize) / hopSize)

    if (numWindows <= 0) return chromagram

    // Hanning window
    const window = new Float32Array(windowSize)
    for (let i = 0; i < windowSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)))
    }

    for (let w = 0; w < numWindows; w++) {
      const offset = w * hopSize
      const windowed = new Float32Array(windowSize)
      for (let i = 0; i < windowSize; i++) {
        windowed[i] = data[offset + i] * window[i]
      }

      // Compute magnitude spectrum using DFT at chromatic pitch frequencies
      for (let note = 0; note < 12; note++) {
        let energy = 0
        // Check octaves 2-7 (65Hz to 4186Hz)
        for (let octave = 2; octave <= 7; octave++) {
          const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12)
          const bin = Math.round(freq * windowSize / this.sampleRate)
          if (bin > 0 && bin < windowSize / 2) {
            // Goertzel-like single-bin DFT
            const magnitude = this.goertzel(windowed, freq, this.sampleRate)
            // Weight lower octaves more (fundamental is more reliable)
            energy += magnitude * (1 / (1 + (octave - 3) * 0.15))
          }
        }
        chromagram[note] += energy
      }
    }

    // Normalize by window count
    for (let i = 0; i < 12; i++) chromagram[i] /= numWindows

    return chromagram
  }

  private goertzel(data: Float32Array, targetFreq: number, sampleRate: number): number {
    const N = data.length
    const k = Math.round(targetFreq * N / sampleRate)
    const w = (2 * Math.PI * k) / N
    const cosW = Math.cos(w)
    const coeff = 2 * cosW

    let s0 = 0, s1 = 0, s2 = 0

    for (let i = 0; i < N; i++) {
      s0 = data[i] + coeff * s1 - s2
      s2 = s1
      s1 = s0
    }

    return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2)
  }

  private rotateArray(arr: number[], shift: number): number[] {
    const result = new Array(arr.length)
    for (let i = 0; i < arr.length; i++) {
      result[i] = arr[(i + shift) % arr.length]
    }
    return result
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0

    for (let i = 0; i < n; i++) {
      sumX += x[i]
      sumY += y[i]
      sumXY += x[i] * y[i]
      sumX2 += x[i] * x[i]
      sumY2 += y[i] * y[i]
    }

    const num = n * sumXY - sumX * sumY
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

    return den === 0 ? 0 : num / den
  }
}
