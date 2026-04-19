# D4NCE | AI-Powered DJ System

**Live demo: [d4ncedj.vercel.app](https://d4ncedj.vercel.app/)**

Dual-deck DJ workstation in the browser with an AI copilot that plans full transitions. Load tracks. Talk to the copilot. Let it mix.

Runs entirely on the Web Audio API. No plugins, no install, no desktop host.

## Showcase

**Landing — one scroll, straight into the mix**

The landing previews the product in motion. Two scrolling waveforms, a crossfade automation curve, and an AI terminal that types plausible analysis. Click *Launch the mix*, the boot loader streams terminal lines, then the workspace fades in.

![D4NCE landing walkthrough](assets/showcase/landing.gif)

**AI copilot — narration before the plan lands**

Press *Transition* and the copilot streams a live play-by-play using real engine data: outgoing deck, incoming deck, Camelot key match, energy phase, exit point, entry cue, blend duration. The narration isn't pre-canned. It's pulled from the song-structure analyzer, the BPM detector, and the key wheel at the moment of the click.

![AI copilot narration](assets/showcase/ai-copilot.gif)

**AI transition — phrase-locked blend in flight**

The plan runs. Crossfade automation, per-deck EQ bass swap, filter sweep, and reverb tail — all timed to musical phrase boundaries, not a fixed duration. The visualizer reacts to the combined output.

![AI transition automation](assets/showcase/ai-transition.gif)

## What It Does

D4NCE is a full DJ workstation in the browser. Two independent decks feed through a mixer with 3-band EQ, resonant filters, reverb, delay, flanger, and per-stem isolation. The copilot listens to plain English or voice and returns not a single command but a full transition plan with crossfade curves, EQ automation, tempo ramps, filter sweeps, and effect envelopes — all timed to musical structure.

Everything runs in the browser. Track analysis, stem isolation, BPM and key detection, song-structure segmentation, and the mix itself. The only server round-trips are AI planning calls and Blob uploads.

## Quick Start

```bash
pnpm install
```

Create `.env.local`:

```env
XAI_API_KEY=your_xai_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
ANTHROPIC_API_KEY=your_anthropic_api_key
```

```bash
pnpm dev
# open http://localhost:2001
```

## How the Transition Engine Works

### Detect → Analyze → Plan → Execute

```
Track load → BPM + Key + Structure → Copilot plan → Automation graph → Audio engine
                    ↑                       ↑                  ↑
             Web Audio analyser       Grok / Claude       Scheduled Web Audio
             (FFT, autocorrelation)   (JSON plan)         (setValueCurveAtTime)
```

### Track Analysis

Every loaded track is analyzed on the fly:

| Stage | Technique | Output |
|-------|-----------|--------|
| **BPM** | FFT + autocorrelation on transients | Tempo to 0.1 BPM precision |
| **Key** | Chroma vector + Krumhansl-Schmuckler template matching | Musical key in Camelot notation (e.g. `8A`, `11B`) |
| **Structure** | Spectral flux + energy envelope segmentation | Phrases, buildups, drops, breakdowns, outros with bar positions |
| **Waveform** | Per-band peak extraction (bass / mid / high) | Colored multi-band waveform for display |
| **Stems** | Spectral masking on bass, vocal, and melody bands | Per-deck isolation sliders |

### Copilot Plans, Not Commands

The AI copilot doesn't execute one-shot actions. It returns a structured transition plan:

```json
{
  "durationSeconds": 16,
  "startDelay": 3.2,
  "incomingStartSeconds": 32,
  "crossfadeAutomation": [{ "t": 0, "value": 0 }, { "t": 8, "value": 0.5 }, { "t": 16, "value": 1 }],
  "deckAEqAutomation": { "low": [...], "mid": [...], "high": [...] },
  "deckBEqAutomation": { "low": [...], "mid": [...], "high": [...] },
  "deckATempoAutomation": [...],
  "filterAutomation": [...],
  "triggers": [{ "t": 4, "deck": "outgoing", "action": "echo-out" }]
}
```

The plan schedules every parameter change against a shared timeline. The engine applies automation using `AudioParam.setValueCurveAtTime` so everything rides the same clock. Phrase alignment is the default: the copilot pulls the next exit point from the outgoing track's structure analysis (drop-to-breakdown, end of phrase) and the best entry point from the incoming track (first beat of the drop), then sizes the blend to land on both.

### Signal Aggregation for Recommendations

When the copilot picks what to play next, it scores every track in the library:

| Signal | Weight | What It Measures |
|--------|--------|------------------|
| Harmonic compatibility | 40% | Camelot wheel distance from current key |
| BPM match | 25% | Closeness in tempo (tolerates ±6% pitch shift) |
| Energy flow | 20% | Match between incoming energy and outgoing energy trend |
| Genre | 10% | Tag overlap |
| Recency | 5% | Avoid recently-played tracks |

The top-scoring match is offered, with a one-sentence rationale.

## AI Copilot

The copilot supports three models:

| Model | Provider | Best For |
|-------|----------|----------|
| Claude Sonnet 4.6 | Anthropic | Detailed transition planning, complex mixes |
| Claude Haiku 4.5 | Anthropic | Fast responses, simple commands |
| Grok 3 | xAI | Voice responses with TTS, streaming |

What it can do:

- Plan full transitions using 8 techniques: bass swap, EQ blend, filter sweep, echo out, quick cut, long blend, energy drop, buildup
- Automate crossfader, per-deck EQ, tempo, filters, stem isolation over time
- Analyze tracks for BPM, key, genre, mood, and energy
- Recommend next tracks with a scored breakdown
- Generate mixer presets from text descriptions (*"dark techno vibe"*, *"chill lounge set"*)
- Detect song structure for phrase-aligned transitions
- Respond with text-to-speech using 6 voice options

Voice commands via the Web Speech Recognition API — `"smooth transition to deck B"`, `"drop the bass on A"`, `"load Phase Shift"`, `"fade to B"`. Real-time interim transcription shows what the copilot is hearing.

## Workspace

- Draggable, resizable floating panels: Mix, Library, AI copilot
- Fullscreen 3D audio-reactive visualizer (Cymatic, Tunnel, Waveform, Spectrum, Grok modes) behind everything
- Keyboard shortcut: Escape collapses expanded panels
- 6-step guided tour for new users
- Skip the landing intro with `?skipIntro`

## Tech Stack

| Layer | Tools |
|-------|-------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, shadcn/ui (New York), Radix UI |
| Audio | Web Audio API (custom dual-deck engine) |
| AI | Claude via `@ai-sdk/anthropic`, Grok via `@ai-sdk/xai` |
| 3D | Three.js, React Three Fiber |
| Storage | Vercel Blob |
| Fonts | Orbitron (display / mono), Rajdhani (sans) |

## Project Structure

```
D4NCE/
├── app/
│   ├── api/
│   │   ├── grok/              # AI endpoints (analyze, transition, voice, speak, preset, recommend)
│   │   └── tracks/            # Track upload + CRUD
│   ├── page.tsx               # Landing gate + workspace shell
│   ├── layout.tsx             # Root layout, fonts, metadata
│   └── globals.css            # Tailwind base + keyframes + glass/btn utilities
├── components/
│   ├── landing/               # Marketing landing + hero canvas + launch loader
│   ├── dj/dj-help-modal.tsx   # 6-step onboarding tour
│   ├── grok/grok-chat-panel.tsx   # AI chat panel
│   ├── library/music-library.tsx  # Library UI
│   ├── visualizer/            # 3D audio-reactive visualization
│   ├── ui/                    # shadcn primitives (do not edit directly)
│   ├── ai-panel.tsx           # AI copilot wrapper
│   ├── draggable-card.tsx     # Floating panel system
│   ├── mixer-panel.tsx        # Mixer with EQ/FX/ISO/A|B tabs
│   ├── top-bar.tsx            # App header
│   └── transport-bar.tsx      # Playback controls
├── hooks/
│   ├── use-music-engine.ts    # Audio engine lifecycle
│   ├── use-tracks.ts          # Track CRUD + upload
│   └── use-voice-commands.ts  # Speech recognition
├── lib/
│   ├── music-engine.ts        # Core Web Audio graph
│   ├── music-store.ts         # Global track + deck state
│   ├── types.ts               # Shared types (Camelot wheel, MusicObject, Track)
│   ├── audio-analyzer.ts      # Realtime frequency analysis
│   ├── bpm-detector.ts        # FFT-based tempo detection
│   ├── key-detector.ts        # Musical key detection
│   ├── song-structure.ts      # Phrase / drop / buildup analysis
│   ├── track-scorer.ts        # Compatibility scoring for recommendations
│   ├── waveform-generator.ts  # Per-band peak extraction
│   └── ai-model.ts            # Model selection / config
├── assets/showcase/           # README gifs
├── docs/                      # Deep-dive notes (AI_TRANSITION_SYSTEM.md)
├── plans/                     # Per-feature plans
└── public/                    # Next.js static assets + uploads
```

## API Endpoints

### AI

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/grok/voice` | Process voice/text command, return mixer actions |
| POST | `/api/grok/analyze` | Analyze a track (BPM, key, genre, mood, energy) |
| POST | `/api/grok/transition` | Generate full transition plan with automation curves |
| POST | `/api/grok/preset` | Create a mixer preset from a text description |
| POST | `/api/grok/recommend` | Suggest compatible tracks with scoring breakdown |
| POST | `/api/grok/speak` | Text-to-speech audio |

### Tracks

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tracks` | List library |
| POST | `/api/tracks/upload` | Upload track to Vercel Blob |
| PATCH | `/api/tracks/[id]` | Update track metadata |
| DELETE | `/api/tracks` | Remove track |

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `XAI_API_KEY` | xAI API key for Grok models | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Yes |

## Commands

```bash
pnpm dev         # Dev server on :2001 (Turbopack)
pnpm build       # Production build
pnpm start       # Production server on :3001
pnpm lint        # ESLint
pnpm typecheck   # TypeScript check (run before shipping)
```

> `next.config.mjs` has `ignoreBuildErrors: true` — TypeScript errors do NOT block production builds. Always run `pnpm typecheck` before pushing.

## Deployment

Runs on Vercel at [d4ncedj.vercel.app](https://d4ncedj.vercel.app/). Set the three environment variables in the Vercel dashboard and push to `main`.

---

Built by Thomas Ou
