import { streamText } from "ai"
import { xai } from "@ai-sdk/xai"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { command, audioSnapshot, currentTrackA, currentTrackB, musicObject, conversationHistory, availableTracks, audioContext: audioCtx } =
      await request.json()

    if (!command) {
      return new Response(JSON.stringify({ error: "Voice command is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Build context about current audio state
    let audioContext = ""
    if (audioSnapshot) {
      audioContext = `
Current Audio State:
- Overall Energy: ${(audioSnapshot.energyLevel * 100).toFixed(0)}%
- Bass Energy: ${(audioSnapshot.bassEnergy * 100).toFixed(0)}%
- Mid Energy: ${(audioSnapshot.midEnergy * 100).toFixed(0)}%
- High Energy: ${(audioSnapshot.highEnergy * 100).toFixed(0)}%
- Beat Intensity: ${(audioSnapshot.beatIntensity * 100).toFixed(0)}%
- Tone: ${audioSnapshot.spectralCentroid > 0.5 ? "Bright" : "Warm/Dark"}
`
    }

    // Build track context with harmonic info
    let trackContext = ""
    if (currentTrackA) {
      trackContext += `Deck A: "${currentTrackA.title}" (${currentTrackA.bpm ?? "?"}BPM, Key: ${currentTrackA.camelotKey ?? currentTrackA.key ?? "?"})\n`
    } else {
      trackContext += `Deck A: Empty\n`
    }
    if (currentTrackB) {
      trackContext += `Deck B: "${currentTrackB.title}" (${currentTrackB.bpm ?? "?"}BPM, Key: ${currentTrackB.camelotKey ?? currentTrackB.key ?? "?"})\n`
    } else {
      trackContext += `Deck B: Empty\n`
    }

    // Harmonic compatibility
    if (currentTrackA?.camelotKey && currentTrackB?.camelotKey) {
      // Import the function inline since this is an API route
      const camelotA = currentTrackA.camelotKey
      const camelotB = currentTrackB.camelotKey
      trackContext += `Harmonic: ${camelotA} → ${camelotB}\n`
    }
    
    // Available tracks
    let libraryContext = ""
    if (availableTracks && availableTracks.length > 0) {
      libraryContext = `\n\nMusic Library (${availableTracks.length} tracks available):\n` + 
        availableTracks.slice(0, 15).map((t: any) => 
          `- "${t.title}" by ${t.artist || 'Unknown'} [ID: ${t.id}] (${t.bpm || '?'}BPM, ${t.key || '?'})`
        ).join('\n')
      if (availableTracks.length > 15) {
        libraryContext += `\n... and ${availableTracks.length - 15} more tracks`
      }
    }

    // Build mixer state context
    let mixerContext = ""
    if (musicObject) {
      mixerContext = `
Current Mixer State:
- Crossfader: ${(musicObject.crossfader * 100).toFixed(0)}% (0=Deck A, 100=Deck B)
- Master Volume: ${(musicObject.masterGain * 100).toFixed(0)}%
- EQ Low: ${musicObject.eq?.low?.toFixed(1) || 0}dB
- EQ Mid: ${musicObject.eq?.mid?.toFixed(1) || 0}dB
- EQ High: ${musicObject.eq?.high?.toFixed(1) || 0}dB
- Filter: ${musicObject.filter?.type || "lowpass"} at ${musicObject.filter?.cutoff || 20000}Hz
- Reverb: ${((musicObject.reverbAmount || 0) * 100).toFixed(0)}%
- Delay: ${((musicObject.delayAmount || 0) * 100).toFixed(0)}%
`
    }

    // Audio context buffer summary (rolling 60s of audio state)
    let contextBufferInfo = ""
    if (audioCtx?.summary) {
      contextBufferInfo = `
Live Audio Context (last 60s):
${audioCtx.summary}
Energy Phase: ${audioCtx.energyPhase ?? "unknown"}
`
    }

    const systemPrompt = `You are GROK, an AI DJ co-pilot. Be EXTREMELY BRIEF - maximum 1 short sentence, then JSON.

You can: load tracks to decks, control mixer (crossfader, EQ, filters, effects), create transitions.

Respond format: One sentence + JSON block.

Actions:
- mixer: Change settings
- loadTrack: Load track by ID or title to deck A or B (automatically starts playing)
  Format: {"action":"loadTrack","trackId":"exact-id"} OR {"action":"loadTrack","trackTitle":"partial name"}
- play/pause: Control playback
- transition: Create a smooth automated DJ transition with crossfading and effects
  Format: {"action":"transition","type":"smooth"} OR {"action":"transition","trackTitle":"[name]"} to load & transition

Examples:
"Bass" → "Bass +4dB. \`\`\`json\n{"action":"mixer","settings":{"eq":{"low":4}}}\n\`\`\`"

"Load [track] to A" → "Loading. \`\`\`json\n{"action":"loadTrack","trackId":"[ID]","deck":"A"}\n\`\`\`"

"Play Summer Vibes" → "Playing Summer Vibes. \`\`\`json\n{"action":"loadTrack","trackTitle":"Summer Vibes"}\n\`\`\`"

"Play" → "Playing. \`\`\`json\n{"action":"play"}\n\`\`\`"

"Fade to B" → "Fading to B. \`\`\`json\n{"action":"mixer","settings":{"crossfader":1}}\n\`\`\`"

"Transition to B" → "Creating transition. \`\`\`json\n{"action":"transition","type":"smooth"}\n\`\`\`"

"Transition to Fire" → "Transitioning to Fire! \`\`\`json\n{"action":"transition","trackTitle":"Fire"}\n\`\`\`"

"Mix into Summer Vibes" → "Mixing into Summer Vibes! \`\`\`json\n{"action":"transition","trackTitle":"Summer Vibes"}\n\`\`\`"

${trackContext}${libraryContext}
${mixerContext}${contextBufferInfo}

CRITICAL RULES:
1. When user says "transition to [track name]", "mix into [track]", "blend to [track]" - use "transition" action with trackTitle
2. When user says "play [track]" or "load [track]" - use "loadTrack" action
3. "transition" action = professional DJ crossfade with automation. "loadTrack" = just load and play
4. If a track needs to be loaded for a transition, include trackTitle in the transition action
5. For "loadTrack", you can omit "deck" field - system auto-chooses the best deck
6. Use "trackTitle" with partial/fuzzy matching (e.g., "Fire" matches "Alan Walker - Fire!")

DJ INTELLIGENCE:
- Use Camelot keys shown above for harmonic mixing awareness
- When recommending transitions, mention if keys are compatible or clashing
- Consider the energy phase (warmup/build/peak/sustain/cooldown) when suggesting actions
- If the user asks "what should I play next", consider BPM proximity and key compatibility from the library
`

    const messages = [...(conversationHistory || []).slice(-10), { role: "user" as const, content: command }]

    const result = streamText({
      model: xai("grok-3-fast"),
      system: systemPrompt,
      messages,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Voice command error:", error)
    return new Response(JSON.stringify({ error: "Failed to process voice command" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
