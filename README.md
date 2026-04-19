# D4NCE | AI-Powered DJ System

**Live demo: [d4ncedj.vercel.app](https://d4ncedj.vercel.app/)**

A browser-based dual-deck DJ system with AI mixing. Load tracks, talk to the AI in plain English or by voice, and let it handle transitions, EQ automation, beat matching, and effect chains while you stay in creative control. Runs entirely in the browser using the Web Audio API.

## Showcase

**Landing + workspace entry.** Breathing wordmark, live transition demo, launch loader, then straight into the dual-deck workspace.

![landing walkthrough](./assets/showcase/landing.gif)

**AI narration.** Press Transition and the copilot streams the play-by-play using real engine data: outgoing deck, Camelot key match, energy phase, exit point, entry cue, blend duration.

![ai copilot narration](./assets/showcase/ai-copilot.gif)

**AI transition in flight.** The plan runs: crossfade automation, EQ bass swap, filter sweep, and reverb tail, all phrase-aligned to the drop.

![ai transition automation](./assets/showcase/ai-transition.gif)

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
```

Open `http://localhost:2001`.

## What It Does

D4NCE is a full DJ workstation in the browser. Two independent decks feed through a mixer with 3-band EQ, resonant filters, reverb, delay, flanger, and stem isolation. An AI copilot powered by Claude or Grok listens to voice or text commands and generates complete transition plans with crossfade curves, EQ bass swaps, tempo ramps, filter sweeps, and effect automation, all timed to musical phrase boundaries.

The interface is built around draggable, resizable panels over a full-screen 3D audio visualizer. Everything responds to the music in real time.

### Dual Deck Engine

Each deck operates independently with its own audio processing chain:

- **Playback** -- play, pause, reset, per-deck volume and gain control
- **3-Band EQ** -- high, mid, low bands with +/-12dB range per deck
- **Filters** -- lowpass, highpass, bandpass with logarithmic cutoff (20Hz-20kHz) and Q factor
- **Effects** -- reverb (impulse response with early reflections + diffuse tail), delay (2s max with feedback), flanger (variable rate and depth)
- **Stem Isolation** -- separate bass, voice, and melody stems per deck with independent level control
- **Tempo** -- playback rate adjustment from 50% to 150% for beatmatching
- **Cue Points** -- create and jump to time markers with custom color coding
- **Loops** -- 1, 2, 4, 8, or 16 beat loop regions with visual highlighting
- **Vinyl Brake** -- physical turntable-style stop with momentum simulation
- **BPM Detection** -- real-time tempo analysis using FFT
- **Waveform Display** -- frequency-colored waveform (bass, mid, high bands) with playback progress and loop region overlay

### AI Copilot

The AI copilot controls the mix through natural language. It doesn't just execute single commands -- it plans multi-step transitions with precise timing and automation curves.

**Three model options:**

| Model | Provider | Best For |
|---|---|---|
| Claude Sonnet 4.6 | Anthropic | Detailed transition planning, complex mixing |
| Claude Haiku 4.5 | Anthropic | Fast responses, simple commands |
| Grok 3 | xAI | Voice responses with TTS, streaming |

**What the AI can do:**

- Plan full transitions between decks using 8 techniques: bass swap, EQ blend, filter sweep, echo out, quick cut, long blend, energy drop, and buildup
- Automate crossfader, per-deck EQ, tempo, filters, and stem isolation over time
- Analyze tracks for BPM, key (Camelot Wheel notation), genre, mood, and energy
- Recommend next tracks scored by harmonic compatibility (40%), BPM match (25%), energy flow (20%), genre (10%), and recency (5%)
- Generate mixer presets from text descriptions ("dark techno vibe", "chill lounge set")
- Detect song structure (phrases, drops, buildups, breakdowns, outros) for phrase-aligned transitions
- Respond with text-to-speech using 6 voice options: Ara, Rex, Sal, Eve, Una, Leo

**Live narration.** Pressing the Transition button streams a play-by-play in the AI panel using real engine data -- outgoing deck, incoming deck, Camelot key match, energy phase, exit point, entry cue, blend duration -- before the AI plan lands.

**Quick action buttons** for common commands: Transition, Match BPM, Drop Bass, Boost Energy.

### Voice Control

Built on the Web Speech Recognition API. Speak commands naturally:

```
"Play both decks"
"Smooth transition to deck B"
"Boost the bass on deck A"
"Add some reverb"
"Load [track name] to deck A"
"Match the BPM"
"Drop the filter"
"Fade to B"
```

Real-time interim transcription shows what the AI is hearing. During voice input, the system also analyzes audio frequency data (bass/mid/high energy, beat intensity, spectral centroid) to give the AI context about what's currently playing.

### Mixer Panel

Four tabbed sections in the mixer:

| Tab | Controls |
|---|---|
| **EQ** | Master 3-band EQ (high/mid/low), filter cutoff with frequency display |
| **FX** | Reverb, delay, and flanger with percentage controls |
| **ISO** | Per-deck stem isolation -- bass, voice, and melody levels for both Deck A and B |
| **A\|B** | Independent 3-band EQ per deck, used for bass-swap mixing technique |

Plus a crossfader (A/B blend), master gain control, and a transition trigger button.

### Track Library

- Upload MP3, WAV, OGG, M4A, AAC, FLAC (up to 50MB per file)
- Cloud storage via Vercel Blob in production
- Search tracks by title, filter by artist or genre
- AI auto-analysis on upload: BPM, musical key, energy level, genre, mood, vibe tags
- One-click load to Deck A or B with visual deck assignment indicators
- Re-analyze tracks on demand

### 3D Visualizer

Full-screen, audio-reactive 3D visualization powered by Three.js and React Three Fiber. Five modes:

| Mode | Description |
|---|---|
| **Cymatic** | Harmonic shape patterns responding to frequency data |
| **Tunnel** | Immersive wormhole effect driven by audio energy |
| **Waveform** | Traditional audio waveform in 3D space |
| **Spectrum** | Frequency spectrum analyzer |
| **Grok** | AI-powered adaptive visualization |

Eight color themes: Neonpunk (default), Cyberpunk, Neon, Monochrome, Fire, Aurora, Sunset, Ocean.

### Workspace

- **Draggable panels** -- mixer, library, and AI copilot panels can be moved anywhere on screen, minimized, or expanded
- **Z-index management** -- click any panel to bring it to front
- **Viewport-aware** -- panels stay within screen bounds, reposition on resize
- **Guided tour** -- 6-step walkthrough for new users (help button in top bar)
- **Keyboard shortcut** -- Escape to minimize expanded panels
- **Skip intro** -- append `?skipIntro` to URL to bypass the landing animation

### Landing

Single-column marketing landing with:

- Breathing **D4NCE** wordmark in Orbitron (mono display) with a violet → fuchsia gradient
- Animated canvas backdrop (waveform bars, particles, perspective grid, scan lines) that fades out on scroll so the page stays readable without lag
- Live transition demo strip: two scrolling waveforms, crossfade automation curve, and an AI terminal that types plausible analysis (`▸ key match: 8A → 9A · compatible`)
- Launch loader: ~2s boot sequence with streaming terminal lines and a three-color progress meter before the workspace fades in

The landing respects `prefers-reduced-motion` and meets WCAG AA contrast across all text.

## Tech Stack

| Layer | Tools |
|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Audio | Web Audio API (custom dual-deck engine) |
| AI | Claude via `@ai-sdk/anthropic`, Grok via `@ai-sdk/xai` |
| 3D | Three.js, React Three Fiber |
| Storage | Vercel Blob |
| Fonts | Orbitron, Rajdhani |

## Project Structure

```
app/
  api/grok/           # AI endpoints: analyze, transition, voice, speak, preset, recommend
  api/tracks/         # Track upload, retrieval, update, delete
  page.tsx            # Main app shell (gates workspace behind landing)
  layout.tsx          # Root layout, fonts, metadata
  globals.css         # Tailwind base + keyframes + glass/btn utilities
components/
  landing/            # Marketing landing + launch loader + hero canvas
  dj/                 # Deck controls, help modal
  grok/               # AI chat panel, voice control, copilot, transition status
  visualizer/         # 3D audio-reactive visualization
  library/            # Track library with search and upload
  ui/                 # shadcn/ui primitives (do not edit directly)
  draggable-card.tsx  # Draggable/resizable panel system
  mixer-panel.tsx     # Mixer with EQ/FX/ISO/A|B tabs
  waveform-strip.tsx  # Per-deck waveform display
  top-bar.tsx         # App header with toggle buttons
  transport-bar.tsx   # Transport controls
hooks/
  use-music-engine.ts # Audio engine lifecycle and state
  use-tracks.ts       # Track CRUD and upload
  use-voice-commands.ts # Speech recognition
lib/
  music-engine.ts     # Core audio engine (Web Audio API graph)
  music-store.ts      # Global track and deck state
  types.ts            # Shared TypeScript types (Camelot wheel, music object)
  audio-analyzer.ts   # Real-time frequency analysis
  bpm-detector.ts     # FFT-based tempo detection
  key-detector.ts     # Musical key detection
  song-structure.ts   # Phrase / drop / buildup analysis
  transition-builder.ts # Automation curve generators
  track-scorer.ts     # Compatibility scoring for recommendations
  ai-model.ts         # AI model selection and configuration
```

## API Endpoints

**AI**

- `POST /api/grok/voice` -- process voice commands, return mixer actions
- `POST /api/grok/analyze` -- analyze track metadata (BPM, key, genre, mood, energy)
- `POST /api/grok/transition` -- generate a full transition plan with automation curves
- `POST /api/grok/preset` -- create mixer preset from text description
- `POST /api/grok/recommend` -- suggest compatible tracks with scoring breakdown
- `POST /api/grok/speak` -- text-to-speech audio generation

**Tracks**

- `GET /api/tracks` -- list library
- `POST /api/tracks/upload` -- upload track to Vercel Blob
- `PATCH /api/tracks/[id]` -- update track metadata
- `DELETE /api/tracks` -- remove track

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `XAI_API_KEY` | xAI API key for Grok models | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | Yes |

## Commands

```bash
pnpm dev         # Dev server on port 2001 (Turbopack)
pnpm build       # Production build
pnpm start       # Production server on port 3001
pnpm lint        # ESLint
pnpm typecheck   # TypeScript check (run before shipping)
```

> **Warning:** `next.config.mjs` has `ignoreBuildErrors: true` -- TypeScript errors do NOT block production builds. Always run `pnpm typecheck` before pushing.

## Deployment

Runs on Vercel at [d4ncedj.vercel.app](https://d4ncedj.vercel.app/). Set all three environment variables in the Vercel dashboard and push to `main`.

---

Built by Thomas Ou
