export interface DjHelpStep {
  step: string
  title: string
  desc: string
  target: string | null
}

export const DJ_HELP_STEPS: DjHelpStep[] = [
  {
    step: "1",
    title: "Welcome to D4NCE",
    desc: "A quick tour of the app. Use the arrow keys or click Next to walk through each section.",
    target: null,
  },
  {
    step: "2",
    title: "Library",
    desc: "Upload and manage your tracks. They're auto-analyzed for BPM, key, and song structure. Hover a track and press A or B to load it onto a deck. You can drag this panel anywhere on screen.",
    target: "library",
  },
  {
    step: "3",
    title: "Transport Bar",
    desc: "Play, pause, and scrub through tracks. The waveform shows where you are in the song. Drag to seek.",
    target: "transport",
  },
  {
    step: "4",
    title: "Mixer & Effects",
    desc: "Crossfader blends between decks. EQ controls lows, mids, and highs. Stem isolation mutes bass, vocals, or melody independently. Add reverb, delay, and filter sweeps. Drag the title bar to move this panel.",
    target: "mixer",
  },
  {
    step: "5",
    title: "AI DJ",
    desc: "Ask the AI to transition between tracks, change the vibe, or adjust settings. Hit the Transition button for a one-click AI mix. All panels can be dragged and repositioned.",
    target: "ai-copilot",
  },
  {
    step: "6",
    title: "Visualizer",
    desc: "The background reacts to your music — bass pulses, beat-synced lasers, and color shifts. It intensifies during transitions.",
    target: "visualizer",
  },
]
