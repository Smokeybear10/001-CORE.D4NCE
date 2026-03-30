# D4NCE AI Transition System

Complete documentation of how the AI-powered DJ transition system works end-to-end.

## Architecture Overview

The AI transition system is a pipeline with 5 stages:

```
User Request → AI Planning → Plan Adaptation → Real-time Execution → State Sync
```

1. **AI Planning** - Grok-3 generates a `TransitionPlan` with detailed automation curves
2. **Plan Adaptation** - `page.tsx` resolves deck references and flips automation if needed
3. **Real-time Execution** - `MusicEngine` applies automation to Web Audio nodes at 50ms intervals
4. **State Sync** - `useMusicEngine` hook syncs engine state back to React for UI updates
5. **Context Feedback** - `AudioContextBuffer` captures live audio state for future AI calls

---

## Data Flow

```
                         ┌──────────────┐
                         │   User/Chat  │
                         └──────┬───────┘
                                │
                    ┌───────────▼────────────┐
                    │  /api/grok/transition   │
                    │  (Grok-3 AI generates   │
                    │   TransitionPlan)        │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  handleApplyTransition  │
                    │  (page.tsx)             │
                    │  - Detect outgoing deck │
                    │  - Swap A/B if needed   │
                    │  - Resolve triggers     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  MusicEngine            │
                    │  applyTransitionPlan()  │
                    │  - 50ms update loop     │
                    │  - Interpolate all      │
                    │    automation params    │
                    │  - Apply to Web Audio   │
                    └───────────┬─────────────┘
                                │
                  ┌─────────────┼─────────────┐
                  │             │             │
            ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐
            │ Web Audio  │ │ React   │ │ Context     │
            │ Output     │ │ State   │ │ Buffer      │
            │ (speakers) │ │ (UI)    │ │ (next AI)   │
            └────────────┘ └─────────┘ └─────────────┘
```

---

## API Routes (`app/api/grok/`)

### POST `/api/grok/transition`

The core AI transition planner. Takes two tracks + current mixer state and returns a full automation plan.

**Request body:**
- `trackA` - Outgoing track metadata (title, artist, genre, BPM, key, energy, mood)
- `trackB` - Incoming track metadata
- `currentMusicObject` - Current mixer state
- `userPrompt?` - Optional DJ instruction (e.g., "make it dramatic")
- `audioContext?` - Rolling 60s audio summary from `AudioContextBuffer`

**What the AI receives:**
- Track metadata for both decks
- BPM analysis (difference, ratio, beatmatch feasibility)
- Harmonic analysis via Camelot wheel (PERFECT/GOOD/OK/CLASH rating)
- Live audio context (energy phase, frequency breakdown, recent events)
- Detailed instructions on DJ techniques, timing, and constraints

**What the AI returns:** A `TransitionPlan` object (see below).

**Key AI rules enforced via prompt:**
- Smooth crossfader automation (5+ points, 0.0 to 1.0)
- Bass swap to prevent muddy low-end
- Harmonic clash avoidance (use effects to mask bad key combinations)
- Energy arc awareness (don't transition during buildups)
- Stem isolation/EQ mutual exclusion (never both on same deck)
- Trigger restrictions (vinyl brake only for hard transitions)

### POST `/api/grok/recommend`

Track recommendation engine with deterministic pre-scoring.

**Flow:**
1. `scoreLibrary()` ranks all tracks by harmonic (40%), BPM (25%), energy (20%), genre (10%), recency (5%)
2. Top 10 candidates sent to Grok-3 with pre-computed scores
3. AI applies creative judgment, returns up to 5 picks with reasons

### POST `/api/grok/analyze`

AI metadata extraction. Cleans messy filenames into proper title/artist, estimates BPM, key, genre, mood, energy.

### POST `/api/grok/preset`

Generates mixer presets from vibes. Input: "dark techno warehouse" -> Output: complete EQ, filter, effects, tempo config.

### POST `/api/grok/voice`

Real-time voice command processing. Receives natural language, returns action JSON (loadTrack, transition, play, pause, mixer).

### POST `/api/grok/speak`

Text-to-speech via XAI TTS API. Converts DJ coach messages to audio.

---

## TransitionPlan Type

The central data structure. All `t` values are normalized 0-1 (progress through the transition).

```typescript
interface TransitionPlan {
  // Timing
  startDelay?: number           // Seconds to wait before starting (phrase alignment)
  durationSeconds: number       // Total transition duration (8-120s)

  // Strategy
  technique?: "bass_swap" | "eq_blend" | "filter_sweep" | "echo_out"
            | "quick_cut" | "long_blend" | "energy_drop" | "build_up"
  phaseAlignment?: "phrase_start" | "drop" | "breakdown" | "buildup" | "outro"

  // Volume balance (MANDATORY)
  crossfadeAutomation: { t: number; value: number }[]
  // value: 0.0 = 100% Deck A, 0.5 = equal, 1.0 = 100% Deck B

  // Per-deck EQ (-12 to +12 dB)
  deckAEqAutomation?: { t: number; low: number; mid: number; high: number }[]
  deckBEqAutomation?: { t: number; low: number; mid: number; high: number }[]

  // Tempo automation (±5% for natural beatmatching)
  deckATempoAutomation?: { t: number; playbackRate: number }[]
  deckBTempoAutomation?: { t: number; playbackRate: number }[]

  // Master filter sweeps
  filterAutomation?: { t: number; cutoff: number; q: number }[]

  // Effects
  fxAutomation?: {
    t: number
    reverb: number        // 0-1
    delay: number         // 0-1
    flangerMix?: number   // 0-0.3 (subtle modulation only)
  }[]

  // Stem isolation per deck (0=muted, 1=full)
  deckAIsolationAutomation?: { t: number; bass: number; voice: number; melody: number }[]
  deckBIsolationAutomation?: { t: number; bass: number; voice: number; melody: number }[]

  // One-shot effects
  triggers?: {
    t: number                              // When to fire (0-1 progress)
    type: "vinylBrake" | "spinback"        // Effect type
    deck: "outgoing" | "incoming" | "A" | "B"
    duration?: number                      // Effect length in seconds
  }[]

  visualizerConfig?: Partial<MusicObject>
  explanation?: string
}
```

---

## Audio Engine (`lib/music-engine.ts`)

### How Transitions Execute

`applyTransitionPlan()` starts a 50ms interval that:

1. Calculates normalized progress (0-1) based on elapsed time
2. For each automation array, finds the two surrounding keyframes
3. Interpolates using cubic smoothstep: `ratio^2 * (3 - 2*ratio)`
4. Applies interpolated values to Web Audio nodes
5. Fires one-shot triggers when progress crosses their `t` value
6. Syncs all values back to `musicObject` for UI reflection
7. Notifies registered callbacks with updated `TransitionState`

### Parameters Applied Each Frame

| Parameter | Source | Web Audio Target |
|-----------|--------|-----------------|
| Crossfader | `crossfadeAutomation` | Deck A/B gain nodes (constant-power curve) |
| Deck A EQ | `deckAEqAutomation` | BiquadFilter nodes (lowshelf, peaking, highshelf) |
| Deck B EQ | `deckBEqAutomation` | BiquadFilter nodes |
| Filter | `filterAutomation` | Master BiquadFilter (cutoff + Q) |
| Reverb | `fxAutomation.reverb` | ConvolverNode wet gain |
| Delay | `fxAutomation.delay` | DelayNode feedback gain |
| Flanger | `fxAutomation.flangerMix` | Flanger wet/dry gain balance |
| Deck A stems | `deckAIsolationAutomation` | Per-stem isolation GainNodes (bass/voice/melody) |
| Deck B stems | `deckBIsolationAutomation` | Per-stem isolation GainNodes |
| Tempo A | `deckATempoAutomation` | AudioBufferSourceNode.playbackRate |
| Tempo B | `deckBTempoAutomation` | AudioBufferSourceNode.playbackRate |
| Triggers | `triggers` | vinylBrake/spinback one-shot effects |

### Stem Isolation vs EQ

Two ways to manage frequency content per deck:

- **EQ** (`deckAEqAutomation`): Boost/cut frequency bands with BiquadFilters. Good for subtle tonal shaping. Range: -12 to +12 dB.
- **Stem Isolation** (`deckAIsolationAutomation`): Mute/unmute individual stems (bass, voice, melody) using bandpass-filtered parallel paths. Cleaner separation than EQ.

**Critical rule:** Never use both on the same deck simultaneously for bass. Stem isolation at bass=0 + EQ low=-12 would double-cut, creating an unnatural hollow sound.

### One-Shot Triggers

Fired exactly once when transition progress crosses their `t` value. Tracked with a `Set<number>` to prevent double-firing.

- **vinylBrake**: Exponential decay of playbackRate to 0.01. Used for hard stops on the outgoing deck.
- **spinback**: Quick reverse scratch effect. 30% of duration to ramp down.

Only appropriate for `quick_cut` or `energy_drop` techniques.

### Constant-Power Crossfade

```
gainA = sqrt(1 - crossfader)
gainB = sqrt(crossfader)
```

This prevents the volume dip at center position (0.5) that a linear crossfade would create. At center: both decks at ~70.7% gain, perceived as equal loudness.

---

## Plan Adaptation (`app/page.tsx`)

`handleApplyTransition()` adapts the AI-generated plan before execution:

### 1. Deck Detection

The AI always generates plans assuming A is outgoing and B is incoming. But the user might have B playing:

- If only B is playing: `outgoingDeck = "B"`, `incomingDeck = "A"`
- If both playing: A is outgoing (crossfader position could refine this)
- If neither playing: start whichever has a track loaded

### 2. Trigger Resolution

AI uses semantic references ("outgoing", "incoming") since it doesn't know which physical deck is which. These get resolved to "A" or "B" before reaching the engine.

### 3. Deck Swap (when outgoing = B)

All per-deck automation arrays get swapped:
- `deckAEqAutomation` <-> `deckBEqAutomation`
- `deckATempoAutomation` <-> `deckBTempoAutomation`
- `deckAIsolationAutomation` <-> `deckBIsolationAutomation`
- Crossfader values inverted: `value` becomes `1 - value`

### 4. Crossfader Continuity

If the current crossfader position doesn't match the plan's starting point (within 5% tolerance), a snap point is prepended to avoid an audible jump.

---

## Audio Context Buffer (`lib/audio-context-buffer.ts`)

Rolling 60-second buffer that captures live audio state for LLM context injection.

### What It Captures (every 500ms)

- Overall energy level
- Bass/mid/high frequency breakdown
- Crossfader position
- BPM per deck
- Camelot keys per deck
- Discrete events (track loads, transition starts, energy shifts)

### Energy Phase Detection

Analyzes the last 15 seconds to determine the current phase:

| Phase | Condition |
|-------|-----------|
| `idle` | Energy < 0.05 |
| `warmup` | Energy 0.05-0.3 |
| `build` | Energy 0.3-0.6 AND rising trend |
| `peak` | Energy > 0.7 |
| `sustain` | Energy 0.5-0.7 AND stable trend |
| `cooldown` | Energy > 0.3 AND falling trend |

### Output Formats

**`getSummary()`** - 3-line text optimized for LLM token efficiency:
```
Energy: 72% [peak] bass=0.8 mid=0.6 high=0.5
Xfade: 0.35 BPM: 128/126 Keys: 8A/5B
Events: transition_start (12s ago), track_loaded (45s ago)
```

**`getStructured()`** - Full object for API calls:
```typescript
{
  summary: "...",
  energyPhase: "peak",
  averageEnergy: 0.72,
  energyTrend: 0.15,       // positive = rising
  camelotA: "8A",
  camelotB: "5B",
  bpmA: 128,
  bpmB: 126,
  recentEvents: [...]
}
```

---

## Track Scorer (`lib/track-scorer.ts`)

Deterministic pre-ranking that runs before LLM calls. Reduces the candidate set from the full library to the top 10, so the AI only evaluates the best matches.

### Scoring Weights

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Harmonic | 40% | Camelot wheel compatibility (same key, adjacent, relative major/minor) |
| BPM | 25% | Tempo proximity, including half/double-time detection |
| Energy | 20% | Smooth energy progression (small changes preferred) |
| Genre | 10% | Keyword matching + genre family groupings |
| Recency | 5% | Slight preference for recently added tracks |

### Harmonic Scoring (Camelot Wheel)

```
Same key (8A → 8A):           1.0  (perfect)
Adjacent same letter (8A → 7A): 0.9  (great)
Relative major/minor (8A → 8B): 0.85 (great)
Adjacent diff letter (8A → 7B):  0.7  (good)
Two steps same letter (8A → 6A): 0.5  (OK)
Further:                        decreasing
```

### BPM Scoring

Handles half-time (64 BPM track matches 128 BPM) and double-time:

```
0-1 BPM diff:   1.0
1-3 BPM diff:   0.95
3-5 BPM diff:   0.85
5-8 BPM diff:   0.7
8-12 BPM diff:  0.5
12+ BPM diff:   linear falloff
```

### Mix Notes

Each scored track gets a human-readable note explaining the match:
- "Perfect harmonic match (8A), BPMs aligned"
- "Key clash, use filter sweep or echo-out"
- "Energy boost +20%, good for building intensity"

---

## React Integration (`hooks/use-music-engine.ts`)

### Update Loop (60 FPS via requestAnimationFrame)

Every frame:
1. Polls engine for playback positions, durations, playing status
2. Retrieves analyser data (frequency + time-domain Uint8Arrays)
3. Feeds `AudioContextBuffer` with current snapshot (self-throttled to 500ms)
4. Updates React state if `musicObject` reference changed

### Transition State Sync

When a transition is active, the `onTransitionUpdate` callback fires every 50ms and syncs:
- `crossfader` -> `musicObject.crossfader`
- `filterCutoff` -> `musicObject.filter.cutoff`
- `reverb` -> `musicObject.reverbAmount`
- `delay` -> `musicObject.delayAmount`
- `flangerMix` -> `musicObject.fx.flangerMix`
- `deckAIsolation` -> `musicObject.tracks.A.bassIsolation/voiceIsolation/melodyIsolation`
- `deckBIsolation` -> `musicObject.tracks.B.bassIsolation/voiceIsolation/melodyIsolation`

This keeps the UI (sliders, meters, visualizer) in sync with the automated transition.

---

## DJ Techniques Reference

The AI selects from these based on track compatibility:

| Technique | When to Use | Duration | Key Features |
|-----------|-------------|----------|-------------|
| `bass_swap` | Standard mixing, compatible keys | 24-48s | Swap bass stems/EQ between decks |
| `eq_blend` | Harmonically compatible tracks | 24-48s | Gradual EQ band crossover |
| `filter_sweep` | Building tension, OK harmonic match | 16-32s | Highpass/lowpass sweeps |
| `echo_out` | Any compatibility, dramatic effect | 16-32s | Delay/reverb on outgoing track |
| `quick_cut` | Similar energy, same genre | 8-16s | Fast swap with minimal blend |
| `long_blend` | Perfect harmonic match, atmospheric | 48-90s | Extended overlap |
| `energy_drop` | Dropping energy intentionally | 16-32s | Cut bass/filter, then fresh start |
| `build_up` | Creating anticipation | 24-48s | Reverb/delay tension before swap |
