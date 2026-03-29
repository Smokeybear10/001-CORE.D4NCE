// Audio analysis utilities for Grok context
export interface AudioSnapshot {
  timestamp: number
  energyLevel: number // 0-1 overall energy
  bassEnergy: number // 0-1 low frequency energy
  midEnergy: number // 0-1 mid frequency energy
  highEnergy: number // 0-1 high frequency energy
  beatIntensity: number // 0-1 estimated beat strength
  spectralCentroid: number // Brightness measure
  dominantFrequencies: number[] // Top frequency bins
}

export function analyzeFrequencyData(frequencyData: Uint8Array, sampleRate = 44100): AudioSnapshot {
  const length = frequencyData.length
  const nyquist = sampleRate / 2
  const binWidth = nyquist / length

  // Proper Hz-based frequency band splits
  const bassEnd = Math.min(length, Math.floor(250 / binWidth))   // 0-250Hz
  const midEnd = Math.min(length, Math.floor(4000 / binWidth))   // 250-4000Hz

  let bassSum = 0
  let midSum = 0
  let highSum = 0
  let totalSum = 0
  let weightedSum = 0

  for (let i = 0; i < length; i++) {
    const value = frequencyData[i] / 255
    totalSum += value
    weightedSum += value * i

    if (i < bassEnd) {
      bassSum += value
    } else if (i < midEnd) {
      midSum += value
    } else {
      highSum += value
    }
  }

  const bassEnergy = bassEnd > 0 ? bassSum / bassEnd : 0
  const midEnergy = midEnd > bassEnd ? midSum / (midEnd - bassEnd) : 0
  const highEnergy = length > midEnd ? highSum / (length - midEnd) : 0
  const energyLevel = totalSum / length

  // Spectral centroid (normalized 0-1 for brightness)
  const spectralCentroid = totalSum > 0 ? weightedSum / totalSum / length : 0

  // Find dominant frequencies (top 5 peaks as bin indices)
  const indexed = Array.from(frequencyData).map((v, i) => ({ value: v, index: i }))
  indexed.sort((a, b) => b.value - a.value)
  const dominantFrequencies = indexed.slice(0, 5).map((d) => d.index)

  // Beat intensity from bass energy spikes (weight bass more for beat detection)
  const beatIntensity = Math.min(1, bassEnergy * 1.5)

  return {
    timestamp: Date.now(),
    energyLevel,
    bassEnergy,
    midEnergy,
    highEnergy,
    beatIntensity,
    spectralCentroid,
    dominantFrequencies,
  }
}

export function describeAudioState(snapshot: AudioSnapshot): string {
  const parts: string[] = []

  // Overall energy description
  if (snapshot.energyLevel > 0.7) {
    parts.push("high energy")
  } else if (snapshot.energyLevel > 0.4) {
    parts.push("moderate energy")
  } else if (snapshot.energyLevel > 0.1) {
    parts.push("low energy")
  } else {
    parts.push("very quiet or silent")
  }

  // Frequency character
  if (snapshot.bassEnergy > 0.6) {
    parts.push("heavy bass")
  }
  if (snapshot.highEnergy > 0.5) {
    parts.push("bright highs")
  }
  if (snapshot.midEnergy > 0.5 && snapshot.bassEnergy < 0.4 && snapshot.highEnergy < 0.4) {
    parts.push("mid-focused")
  }

  // Beat intensity
  if (snapshot.beatIntensity > 0.7) {
    parts.push("strong beat")
  } else if (snapshot.beatIntensity > 0.4) {
    parts.push("rhythmic")
  }

  // Brightness
  if (snapshot.spectralCentroid > 0.6) {
    parts.push("bright/airy tone")
  } else if (snapshot.spectralCentroid < 0.3) {
    parts.push("dark/warm tone")
  }

  return parts.join(", ") || "no audio detected"
}
