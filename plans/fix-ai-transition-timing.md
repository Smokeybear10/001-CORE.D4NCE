# Plan: Fix AI Transition Timing

**Branch**: feat/fix-transition-timing
**Status**: Active

## Goal

Fix the two core transition bugs: (1) outgoing song exits at the wrong time, and (2) incoming song plays from the beginning instead of skipping to the best part.

## Root Cause Analysis

### Bug 1: Outgoing exits at the wrong time

The AI prompt provides `startDelay` based on `findNextExitPoint()` analysis, but the execution model undermines it:

1. `handleApplyTransition` in `page.tsx` (line 181-228) wraps the _entire_ blend automation in a `setTimeout(startDelay)`.
2. During that delay, nothing happens to the outgoing track — it just keeps playing.
3. After the delay, `applyTransitionPlan()` starts a gradual crossfade/EQ automation over `durationSeconds`.
4. The outgoing track doesn't actually get quiet until partway through the blend.

**Result:** The user perceives the outgoing track playing way too long — it plays for `startDelay + (durationSeconds * ~0.5)` before it's noticeably gone. The "exit point" from `findNextExitPoint` was supposed to be when we _leave_, not when we start a slow fade.

**Additionally:** `findNextExitPoint` returns a `time` (absolute position in the song) and a `delay` (time from now until that point). Only `delay` is used as `startDelay`. But the AI may override this with its own `startDelay` that doesn't match the analysis.

### Bug 2: Incoming plays from beginning

The execution in `page.tsx` lines 169-178:
```
seek(incomingDeck, cuePoint)   // Seek to entry point
play(incomingDeck)              // Start playing immediately
setTimeout(() => {              // Wait startDelay before blend
  applyTransitionPlan(...)      // NOW the crossfader starts moving
}, startDelay)
```

The incoming track starts playing _immediately_ at the cue point, but the crossfader is at 0 (all outgoing), so the user hears nothing from it. During `startDelay`, the incoming track advances silently. By the time the blend begins, the incoming track has moved `startDelay` seconds past the cue point.

The prompt (line 389-398) tries to account for this with "TIMING MATH" telling the AI to subtract `startDelay` from `incomingStartSeconds`. But this math is:
- Complex and error-prone for the AI
- Dependent on the AI actually doing the subtraction correctly
- Broken when the incoming track _isn't_ playing during the delay (e.g., when `incomingPlaying` is false and the delay is the minimum 150ms)

**The real fix:** Don't start the incoming track until the blend begins, OR seek to the cue point right when the blend starts (not during `startDelay`).

## Acceptance Criteria

- [ ] When transitioning, the outgoing track begins fading at a musically appropriate moment (phrase boundary, breakdown, or outro) — not in the middle of a drop or buildup
- [ ] The incoming track starts playing from the analyzed best entry point (before the buildup/drop), not from the beginning of the song
- [ ] The incoming track's audio reaches the user at the cue point, not `startDelay` seconds after it
- [ ] `startDelay` of 0 produces the same behavior as before (no regression for immediate transitions)
- [ ] The timing math in the AI prompt is simplified or removed — the system handles it deterministically

## Steps

This is a 2-PR approach: first fix the execution timing (deterministic, no AI changes), then improve the AI prompt (leverages the fixed execution model).

---

### PR 1: Fix transition execution timing

#### Step 1: Defer incoming seek + play until blend starts

**RED**: Write a test (or manual verification) that: when `handleApplyTransition` is called with `startDelay=8` and `incomingStartSeconds=25`, the incoming deck's `pauseTime` is 25 (not 25 + 8) when the blend animation begins.

**GREEN**: In `page.tsx` `handleApplyTransition`:
- Move `seek(incomingDeck, cuePoint)` and `play(incomingDeck)` _inside_ the `setTimeout` callback, right before `applyTransitionPlan()`.
- The crossfader safety setup (`setCrossfade(safeStart)`) stays outside since it's instant.
- This ensures the incoming track starts at exactly `cuePoint` when the blend begins.

```
// BEFORE (broken):
seek(incomingDeck, cuePoint)
play(incomingDeck)
setTimeout(() => { applyTransitionPlan(...) }, startDelay)

// AFTER (fixed):
setTimeout(() => {
  seek(incomingDeck, cuePoint)
  play(incomingDeck)
  applyTransitionPlan(...)
}, startDelay)
```

**REFACTOR**: The crossfader safety logic can stay outside — it's a UI-only change. Verify the `actualCrossfader` capture still works correctly since it's used inside the timeout.

**MUTATE**: N/A (no test runner configured — verify manually by triggering a transition and checking the incoming track starts at the expected position).

**Done when**: Incoming track audibly starts at the cue point (before the buildup), not from the beginning or past the target.

#### Step 2: Use structure-analyzed exit point as a hard override, not a suggestion

**RED**: Verify that when `findNextExitPoint` returns `delay: 0` (breakdown/outro), the transition starts immediately — and when it returns `delay: 12`, the blend starts 12s later.

**GREEN**: In `page.tsx` `handleApplyTransition`:
- Compute the exit point from the outgoing structure directly (currently only done in the API route's prompt).
- Use it as the authoritative `startDelay`, overriding the AI's value when structure data is available.
- Only fall back to the AI's `plan.startDelay` when no structure is available.

```typescript
const outgoingStructure = outgoingDeck === "A" ? structureA : structureB
const outgoingTime = outgoingDeck === "A" ? currentTimeA : currentTimeB
const outgoingDuration = outgoingDeck === "A" ? durationA : durationB

let effectiveDelay = (plan.startDelay || 0) * 1000
if (outgoingStructure && outgoingTime !== undefined) {
  const exit = findNextExitPoint(outgoingStructure, outgoingTime, outgoingDuration)
  effectiveDelay = exit.delay * 1000
}
```

**REFACTOR**: Consider whether the AI should even return `startDelay` anymore, or if it should be purely computed client-side. For now, keep both paths — structure override takes precedence.

**MUTATE**: Manually test with a track in different sections (drop, buildup, breakdown, verse) and verify the delay matches expectations.

**Done when**: Transition starts at musically correct moments based on song structure, regardless of what the AI returns for `startDelay`.

#### Step 3: Simplify AI prompt timing instructions

**RED**: Verify the AI prompt no longer asks for complex "TIMING MATH" calculations that the model gets wrong.

**GREEN**: In `app/api/grok/transition/route.ts`:
- Remove the "TIMING MATH" section (lines 392-398) since the client now handles seek timing.
- Simplify `incomingStartSeconds` instructions: "Set this to the INCOMING ENTRY value shown in the structure analysis. The system will handle playback timing."
- Simplify `startDelay` instructions: "This is a suggestion. The system uses song structure analysis to determine the actual delay. Set to 0 unless you have a specific reason to override."
- Remove the line "The incoming track starts playing IMMEDIATELY (silently behind the crossfader)" since that's no longer true.

**REFACTOR**: Clean up any other prompt sections that reference the old timing model.

**MUTATE**: N/A — prompt changes verified by triggering transitions and checking AI output.

**Done when**: AI prompt is simpler and doesn't require the model to do timing arithmetic.

---

### PR 2: Improve exit point detection (if still needed after PR 1)

#### Step 4: Add current playback time to `handleApplyTransition` dependencies

**RED**: Verify that `currentTimeA` and `currentTimeB` are available inside `handleApplyTransition` at call time (not stale from render).

**GREEN**: In `page.tsx`:
- `currentTimeA` / `currentTimeB` come from `useMusicEngine()` hook. Verify they're in the `useCallback` dependency array (line 230).
- If stale, read fresh values from the music engine directly inside the callback.

**REFACTOR**: Consider whether to read `getCurrentTime("A")` directly from the engine ref instead of relying on React state, which updates on a slower cadence.

**MUTATE**: Log `currentTimeA` inside the callback and compare to the actual audio position.

**Done when**: Exit point calculation uses accurate current playback time, not a stale React state value.

#### Step 5: Cap maximum startDelay to prevent long dead waits

**RED**: Trigger a transition during a buildup where `findNextExitPoint` returns delay > 30s. Verify the user doesn't sit waiting for 45+ seconds.

**GREEN**: In `page.tsx`, after computing `effectiveDelay`:
```typescript
const maxDelay = Math.min(effectiveDelay, 15000) // Cap at 15s
```
If the natural exit point is far away (e.g., we're at the start of a buildup and the drop + resolution is 40s away), cap the delay and let the blend start earlier. The EQ/isolation automation will handle the graceful exit even if we're cutting slightly early.

**REFACTOR**: Consider making the cap relative to `durationSeconds` — e.g., `maxDelay = Math.min(effectiveDelay, plan.durationSeconds * 1000)`.

**MUTATE**: Test with tracks at various positions and verify no delay exceeds the cap.

**Done when**: No transition ever waits more than ~15s before starting the blend.

## Pre-PR Quality Gate

Before each PR:
1. ~~Mutation testing~~ (no test runner configured)
2. ~~Refactoring assessment~~ (minimal changes, focused fix)
3. `pnpm tsc --noEmit` passes
4. `pnpm build` passes
5. Manual QA: trigger 3-5 transitions at different points in songs, verify:
   - Incoming starts at the right spot (before the energy section, not from 0:00)
   - Outgoing fades at a musical moment (not mid-drop)
   - No dead silence gaps
   - `startDelay: 0` still works correctly

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
