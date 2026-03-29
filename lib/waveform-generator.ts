// Generate frequency-colored waveform peak data from audio buffers
import type { WaveformPeak } from "./types"

export function generateWaveformPeaks(
  audioBuffer: AudioBuffer,
  targetPeaks = 800,
): WaveformPeak[] {
  const channelData = audioBuffer.getChannelData(0)
  const samplesPerPeak = Math.floor(channelData.length / targetPeaks)
  const peaks: WaveformPeak[] = []
  const sampleRate = audioBuffer.sampleRate

  // Pre-compute frequency band boundaries for energy analysis
  const fftSize = 256
  const nyquist = sampleRate / 2
  const bassEnd = Math.floor((250 / nyquist) * (fftSize / 2))
  const midEnd = Math.floor((4000 / nyquist) * (fftSize / 2))

  for (let i = 0; i < targetPeaks; i++) {
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, channelData.length)

    let max = -1
    let min = 1
    let sumSquared = 0
    let count = 0

    for (let j = start; j < end; j++) {
      const val = channelData[j]
      if (val > max) max = val
      if (val < min) min = val
      sumSquared += val * val
      count++
    }

    const rms = count > 0 ? Math.sqrt(sumSquared / count) : 0

    // Simple frequency energy estimation using zero-crossing rate and amplitude patterns
    // Full FFT per peak would be too expensive, so we use heuristics
    let lowFreqEnergy = 0
    let midFreqEnergy = 0
    let highFreqEnergy = 0

    // Subsample for frequency estimation
    const step = Math.max(1, Math.floor((end - start) / fftSize))
    let prevVal = 0
    let zeroCrossings = 0
    let slowEnergy = 0
    let fastEnergy = 0

    for (let j = start; j < end; j += step) {
      const val = channelData[j]
      if ((val >= 0 && prevVal < 0) || (val < 0 && prevVal >= 0)) {
        zeroCrossings++
      }

      // Low-pass approximation: running average captures low frequency content
      slowEnergy += Math.abs(val)

      // High-pass approximation: difference from neighbor captures high frequency content
      if (j + step < end) {
        fastEnergy += Math.abs(channelData[j + step] - val)
      }

      prevVal = val
    }

    const segments = Math.floor((end - start) / step)
    if (segments > 0) {
      const normalizedZC = zeroCrossings / segments
      slowEnergy /= segments
      fastEnergy /= segments

      // Map zero-crossing rate to frequency bands
      // Low ZC rate = more bass, high ZC rate = more treble
      lowFreqEnergy = Math.min(1, slowEnergy * 3 * (1 - normalizedZC * 2))
      midFreqEnergy = Math.min(1, rms * 3 * (1 - Math.abs(normalizedZC - 0.3) * 3))
      highFreqEnergy = Math.min(1, fastEnergy * 4 * normalizedZC * 2)
    }

    peaks.push({
      max: Math.max(0, max),
      min: Math.min(0, min),
      rms,
      bassEnergy: Math.max(0, lowFreqEnergy),
      midEnergy: Math.max(0, midFreqEnergy),
      highEnergy: Math.max(0, highFreqEnergy),
    })
  }

  return peaks
}

// Generate compact waveform overview for track library display (fewer peaks)
export function generateWaveformOverview(
  audioBuffer: AudioBuffer,
  targetPeaks = 150,
): number[] {
  const channelData = audioBuffer.getChannelData(0)
  const samplesPerPeak = Math.floor(channelData.length / targetPeaks)
  const overview: number[] = []

  for (let i = 0; i < targetPeaks; i++) {
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, channelData.length)
    let maxAbs = 0

    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j])
      if (abs > maxAbs) maxAbs = abs
    }

    overview.push(maxAbs)
  }

  return overview
}
