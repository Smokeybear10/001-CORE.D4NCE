export interface DjHelpStep {
  step: string
  title: string
  desc: string
}

export const DJ_HELP_STEPS: DjHelpStep[] = [
  {
    step: "1",
    title: "Upload tracks",
    desc: 'Open the panel (menu icon, top-right) → Library → "Upload Tracks" and pick audio files.',
  },
  {
    step: "2",
    title: "Load to decks",
    desc: "Tap A or B on a track (Library) to load Deck A or B — on desktop you can hover the row first.",
  },
  {
    step: "3",
    title: "Play & mix",
    desc: "Go to the DJ tab to play each deck, adjust tempo and gain, and move the crossfader to blend between them.",
  },
  {
    step: "4",
    title: "EQ & FX",
    desc: "Use the EQ sliders to cut/boost lows, mids, and highs. Add reverb or delay in the FX tab.",
  },
  {
    step: "5",
    title: "AI transitions",
    desc: 'Open the AI tab and ask for a transition, e.g. "mix into track B" — the AI will automate the crossfade and EQ.',
  },
  {
    step: "6",
    title: "Visualizer",
    desc: "On your phone, use the pill at the bottom for Bars / Radial / Wave and color themes. On desktop they’re in the header.",
  },
]
