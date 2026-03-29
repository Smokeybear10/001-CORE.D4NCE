# D4NCE | LLM-Driven DJ

A browser-based DJ system powered by Grok AI. Talk to it, give it commands, and let it handle the mix — while you stay in control of the creative direction.

## Quick Start

```bash
pnpm install
```

Create `.env.local`:
```env
XAI_API_KEY=your_xai_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

```bash
pnpm dev
```

Open `http://localhost:3000`.

## What It Does

D4NCE runs two decks with a full mixer — EQ, filters, reverb, delay, crossfader — all controllable via text or voice through Grok. The AI doesn't just execute commands; it plans full transitions with crossfade curves, EQ swaps, tempo matching, and effect automation.

### Core Features

**Voice & Text Control**
- Talk to Grok in plain English: *"Smooth transition to deck B"*, *"Drop the bass"*, *"Match the BPM"*
- Speech recognition with real-time feedback
- Text-to-speech responses (voices: Ara, Eve, Rex, Leo)

**Dual Deck Engine**
- Independent playback control per deck
- 3-band EQ (low, mid, high) + filter per deck
- Reverb, delay, and master gain
- BPM detection and tempo adjustment for beatmatching

**AI Transitions**
- Grok generates full transition plans — crossfade automation, EQ bass swapping, tempo matching, filter sweeps
- Phrase-aware timing (aligns transitions to musical boundaries)
- Configurable incoming cue point to skip track intros

**3D Visualizer**
- Multiple modes: Cymatic, Particles, Tunnel, Waveform
- Audio-reactive, color-themeable, full-screen capable

**Track Library**
- Upload MP3, WAV, OGG, and more (up to 50MB)
- Cloud storage via Vercel Blob in production
- Auto-analyzed: BPM, key, genre, mood, energy

## Voice Command Examples

```
"Play both decks"
"Fade to deck B"
"Boost the bass on deck A"
"Add some reverb"
"Smooth transition"
"Load [track name] to deck A"
"Match the BPM of both decks"
```

## Tech Stack

| Layer | Tools |
|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Audio | Web Audio API (custom dual-deck engine) |
| AI | Grok via `@ai-sdk/xai` |
| 3D | Three.js + React Three Fiber |
| Storage | Vercel Blob |
| Fonts | Orbitron, Rajdhani |

## Project Structure

```
app/
  api/grok/       # AI endpoints: analyze, transition, voice, speak, preset, recommend
  api/tracks/     # Track upload + retrieval
components/
  dj/             # Deck + mixer controls
  grok/           # AI chat panel, voice control, transition status
  visualizer/     # 3D audio visualization
  library/        # Track library UI
hooks/            # use-music-engine, use-tracks, use-voice-commands
lib/
  music-engine.ts     # Core audio engine
  music-store.ts      # Global track state
  types.ts            # Shared TypeScript types
  audio-analyzer.ts   # Frequency analysis
  bpm-detector.ts     # Tempo detection
```

## API Endpoints

**Grok AI**
- `POST /api/grok/voice` — Process voice commands
- `POST /api/grok/analyze` — Analyze track metadata
- `POST /api/grok/transition` — Generate transition plan
- `POST /api/grok/preset` — Create mixer preset
- `POST /api/grok/recommend` — Suggest compatible tracks
- `POST /api/grok/speak` — Text-to-speech

**Tracks**
- `GET /api/tracks` — List library
- `POST /api/tracks/upload` — Upload track
- `PATCH /api/tracks/[id]` — Update metadata
- `DELETE /api/tracks` — Remove track

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `XAI_API_KEY` | xAI API key for Grok | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | Yes |

## Commands

```bash
pnpm dev          # Dev server (Turbopack)
pnpm build        # Production build
pnpm lint         # ESLint
pnpm tsc --noEmit # Type check
```

> **Note:** `ignoreBuildErrors: true` is set in `next.config.mjs` — always run `pnpm tsc --noEmit` before shipping.

## Deployment

Runs on Vercel. Set `XAI_API_KEY` and `BLOB_READ_WRITE_TOKEN` in Vercel environment variables, then push to `main`.

---

Built by Thomas Ou
