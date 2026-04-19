# D4NCE — Project Guide

## Commands

```bash
pnpm dev          # Dev server on :2001 (Turbopack)
pnpm build        # Production build
pnpm start        # Production server on :3001
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (always run before shipping)
```

> **Warning:** `next.config.mjs` has `ignoreBuildErrors: true` — TypeScript errors do NOT block production builds. Always run `pnpm typecheck` before pushing.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4, shadcn/ui (New York style), Radix UI
- **AI:** Grok via `@ai-sdk/xai` — API routes under `app/api/grok/`
- **Audio:** Web Audio API — core logic in `lib/music-engine.ts`
- **3D Visualization:** React Three Fiber + Three.js
- **Storage:** Vercel Blob
- **Package manager:** pnpm

## Project Structure

```
app/
  api/grok/             # AI endpoints (analyze, preset, recommend, speak, transition, voice)
  api/tracks/           # Track upload, retrieval, update, delete
  page.tsx              # Gates workspace behind landing
  layout.tsx            # Root layout, fonts, metadata
  globals.css           # Tailwind base + keyframes + glass/btn utilities

components/
  landing/              # Marketing landing + hero canvas + launch loader
  dj/dj-help-modal.tsx  # 6-step onboarding tour
  grok/grok-chat-panel.tsx  # AI chat panel (used by ai-panel.tsx)
  library/music-library.tsx # Library UI (used by library-drawer.tsx)
  visualizer/           # 3D audio-reactive visualization
  ui/                   # shadcn/ui primitives (do NOT edit directly)
  ai-panel.tsx          # AI chat wrapper
  draggable-card.tsx    # Floating panel system
  error-boundary.tsx
  library-drawer.tsx
  mixer-panel.tsx       # Mixer with EQ/FX/ISO/A|B tabs
  top-bar.tsx
  transport-bar.tsx

hooks/
  use-music-engine.ts   # Audio engine lifecycle
  use-tracks.ts         # Track CRUD + upload
  use-voice-commands.ts # Speech recognition

lib/
  music-engine.ts       # Core Web Audio graph (25KB — handle carefully)
  music-store.ts        # Global track + deck state
  types.ts              # Shared types (Camelot wheel, MusicObject, Track)
  audio-analyzer.ts     # Realtime frequency analysis
  audio-context-buffer.ts
  bpm-detector.ts       # FFT-based tempo detection
  key-detector.ts       # Musical key detection
  song-structure.ts     # Phrase/drop/buildup analysis
  track-metadata.ts
  track-scorer.ts       # Compatibility scoring for recommendations
  waveform-generator.ts
  ai-model.ts           # Model selection/config
  dj-help-steps.ts      # Onboarding tour steps
  utils.ts

assets/showcase/        # README gifs (landing, ai-copilot, ai-transition)
docs/                   # AI_TRANSITION_SYSTEM.md and other deep docs
plans/                  # Per-feature plans (ephemeral)
public/                 # Next.js static assets (icons, placeholder images, uploads/)
```

## TypeScript

- Strict mode enabled
- Path alias: `@/*` maps to project root
- No `noUncheckedIndexedAccess` — be careful with array access
- `ignoreBuildErrors: true` in next.config.mjs — **typecheck manually**

## Testing

No test runner is configured. For TDD work:
- Load the `tdd` skill for workflow
- Load the `front-end-testing` or `react-testing` skill for UI test patterns
- Recommended: add Vitest Browser Mode

## Git

- **Never** add `Co-Authored-By` lines to commit messages
- Keep commit messages short and simple

## Skills

- For TDD workflow: load `tdd`
- For React testing: load `react-testing`
- For TypeScript patterns: load `typescript-strict`
- For frontend design: load `frontend-design`
- For refactoring: load `refactoring`
