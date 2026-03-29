# D4NCE (xBeat) — Project Guide

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm tsc --noEmit  # Type check (no typecheck script in package.json)
```

> **Warning:** `next.config.mjs` has `ignoreBuildErrors: true` — TypeScript errors do NOT block production builds. Always run `pnpm tsc --noEmit` before shipping.

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
app/                  # Next.js App Router
  api/grok/           # Grok AI endpoints (analyze, preset, recommend, speak, transition, voice)
  api/tracks/         # Track upload + retrieval
components/
  dj/                 # Deck + mixer controls
  grok/               # AI chat panel, copilot, voice control
  ui/                 # shadcn/ui primitives (don't edit directly)
  visualizer/         # 3D audio visualization
  library/            # Track library UI
hooks/                # Custom React hooks (music engine, voice, tracks)
lib/
  music-engine.ts     # Core audio engine (25KB — handle carefully)
  music-store.ts      # Global state
  types.ts            # Shared TypeScript types
  audio-analyzer.ts   # Frequency analysis
  bpm-detector.ts     # BPM detection
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
