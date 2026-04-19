"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import { useVoiceCommands } from "@/hooks/use-voice-commands"
import { analyzeFrequencyData, describeAudioState, type AudioSnapshot } from "@/lib/audio-analyzer"
import type { Track, MusicObject, TransitionPlan } from "@/lib/types"
import type { SongStructure } from "@/lib/song-structure"
import { structureToPromptText, findNextExitPoint, findBestEntryPoint } from "@/lib/song-structure"
import { getCamelotCompatibility } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic, MicOff, Send } from "lucide-react"
import type { AIModelId } from "@/lib/ai-model"
import { cn } from "@/lib/utils"
import { deepMerge } from "@/lib/utils"

interface GrokChatPanelProps {
  trackA: Track | null
  trackB: Track | null
  musicObject: MusicObject
  tracks: Track[]
  transitionState: any
  getAnalyserData: () => { frequency: Uint8Array; timeDomain: Uint8Array }
  onApplySettings: (settings: Partial<MusicObject>) => void
  onApplyTransition: (plan: TransitionPlan) => void
  onApplyPreset: (preset: Partial<MusicObject>) => void
  onAction: (action: string, params?: Record<string, unknown>) => void
  onLoadTrack: (track: Track, deck: "A" | "B") => void
  onCancelTransition: () => void
  isPlayingA?: boolean
  isPlayingB?: boolean
  structureA?: SongStructure | null
  structureB?: SongStructure | null
  currentTimeA?: number
  currentTimeB?: number
  durationA?: number
  durationB?: number
  getAudioContext?: () => {
    summary: string
    energyPhase: string
    averageEnergy: number
    energyTrend: number
    camelotA: string | null
    camelotB: string | null
    [key: string]: unknown
  }
}

interface ParsedAction {
  action: string
  settings?: Partial<MusicObject>
  deck?: "A" | "B" | "both"
  transitionType?: string
  trackId?: string
  trackTitle?: string
  transitionPlan?: TransitionPlan
  preset?: Partial<MusicObject>
}

export function GrokChatPanel({
  trackA,
  trackB,
  musicObject,
  tracks,
  transitionState,
  getAnalyserData,
  onApplySettings,
  onApplyTransition,
  onApplyPreset,
  onAction,
  onLoadTrack,
  onCancelTransition,
  isPlayingA,
  isPlayingB,
  structureA,
  structureB,
  currentTimeA,
  currentTimeB,
  durationA,
  durationB,
  getAudioContext,
}: GrokChatPanelProps) {
  const [textInput, setTextInput] = useState("")
  const [selectedModel, setSelectedModel] = useState<AIModelId>("sonnet")
  const [audioSnapshot, setAudioSnapshot] = useState<AudioSnapshot | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analyzeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [localMessages, setLocalMessages] = useState<Array<{ id: string; role: string; content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleAction = useCallback(
    async (parsed: ParsedAction) => {
      switch (parsed.action) {
        case "mixer":
          if (parsed.settings) {
            onApplySettings(parsed.settings)
          }
          break
        case "transition":
          if (parsed.transitionPlan) {
            onApplyTransition(parsed.transitionPlan)
          } else {
            // Check if we need to load a track first
            if (parsed.trackTitle || parsed.trackId) {
              // Find the track to transition to
              const track = tracks.find(
                (t) =>
                  t.id === parsed.trackId ||
                  (parsed.trackTitle && t.title.toLowerCase().includes(parsed.trackTitle.toLowerCase())),
              )
              
              if (track) {
                
                // Determine which deck to load to (opposite of the currently playing one)
                const targetDeck: "A" | "B" = trackA && !trackB ? "B" : !trackA && trackB ? "A" : musicObject.crossfader < 0.5 ? "B" : "A"
                
                // Load the track WITHOUT auto-playing (transition handler will start it)
                onLoadTrack(track, targetDeck)
                // Note: We don't call play() here - the transition handler will start it with proper crossfader position
                
                // Wait for track to load, then request transition
                setTimeout(async () => {
                  const currentTrackA = targetDeck === "A" ? track : trackA
                  const currentTrackB = targetDeck === "B" ? track : trackB
                  
                  if (currentTrackA && currentTrackB) {
                    try {
                      const outDeck: "A" | "B" = isPlayingB && !isPlayingA ? "B"
                        : isPlayingA && isPlayingB ? (musicObject.crossfader <= 0.5 ? "A" : "B")
                        : "A"
                      const outStructure = outDeck === "A" ? structureA : structureB
                      const inStructure = outDeck === "A" ? structureB : structureA
                      const response = await fetch("/api/grok/transition", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          trackA: currentTrackA,
                          trackB: currentTrackB,
                          currentMusicObject: musicObject,
                          userPrompt: parsed.transitionType || "smooth transition",
                          currentTimeA, durationA, currentTimeB, durationB,
                          outgoingDeck: outDeck,
                          audioContext: getAudioContext?.(),
                          outgoingStructure: outStructure ?? undefined,
                          incomingStructure: inStructure ?? undefined,
                          model: selectedModel,
                        }),
                      })
                      if (response.ok) {
                        const { plan } = await response.json()
                        onApplyTransition(plan)
                      }
                    } catch (error) {
                      console.error("[GrokChat] Error requesting transition:", error)
                    }
                  }
                }, 1000) // Wait 1 second for track to load
              } else {
              }
            } else {
              // Normal transition between currently loaded tracks
              if (trackA && trackB) {
                try {
                  const outDeck2: "A" | "B" = isPlayingB && !isPlayingA ? "B"
                    : isPlayingA && isPlayingB ? (musicObject.crossfader <= 0.5 ? "A" : "B")
                    : "A"
                  const outStructure2 = outDeck2 === "A" ? structureA : structureB
                  const inStructure2 = outDeck2 === "A" ? structureB : structureA
                  const response = await fetch("/api/grok/transition", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      trackA, trackB,
                      currentMusicObject: musicObject,
                      userPrompt: parsed.transitionType || "smooth transition",
                      currentTimeA, durationA, currentTimeB, durationB,
                      outgoingDeck: outDeck2,
                      audioContext: getAudioContext?.(),
                      outgoingStructure: outStructure2 ?? undefined,
                      incomingStructure: inStructure2 ?? undefined,
                      model: selectedModel,
                    }),
                  })
                  if (response.ok) {
                    const { plan } = await response.json()
                    onApplyTransition(plan)
                  }
                } catch (error) {
                  console.error("[GrokChat] Error requesting transition:", error)
                }
              } else {
              }
            }
          }
          break
        case "preset":
          if (parsed.preset) {
            onApplyPreset(parsed.preset)
          }
          break
        case "loadTrack":
          const track = tracks.find(
            (t) =>
              t.id === parsed.trackId ||
              (parsed.trackTitle && t.title.toLowerCase().includes(parsed.trackTitle.toLowerCase())),
          )
          if (track) {
            // Intelligently choose which deck to load to
            let targetDeck: "A" | "B"
            
            if (parsed.deck && (parsed.deck === "A" || parsed.deck === "B")) {
              // Use specified deck
              targetDeck = parsed.deck
            } else {
              // Auto-choose deck: prefer empty deck, then non-playing deck, then deck A
              if (!trackA) {
                targetDeck = "A"
              } else if (!trackB) {
                targetDeck = "B"
              } else {
                // Both decks have tracks - load to the one that isn't playing
                // Or if both/neither playing, alternate based on current crossfader position
                const isAPlaying = musicObject.tracks.A?.enabled !== false
                const isBPlaying = musicObject.tracks.B?.enabled !== false
                
                if (isAPlaying && !isBPlaying) {
                  targetDeck = "B"
                } else if (!isAPlaying && isBPlaying) {
                  targetDeck = "A"
                } else {
                  // Both or neither playing - use crossfader position to decide
                  targetDeck = musicObject.crossfader < 0.5 ? "B" : "A"
                }
              }
            }
            
            onLoadTrack(track, targetDeck)
            // Auto-play after loading (give time for track to load)
            setTimeout(() => onAction("play", { deck: targetDeck }), 500)
          } else {
          }
          break
        case "play":
          if (parsed.deck) {
            onAction("play", { deck: parsed.deck })
          } else {
            onAction("play", { deck: "both" })
          }
          break
        case "pause":
          if (parsed.deck) {
            onAction("pause", { deck: parsed.deck })
          } else {
            onAction("pause", { deck: "both" })
          }
          break
      }
    },
    [onApplySettings, onApplyTransition, onApplyPreset, onAction, onLoadTrack, tracks, trackA, trackB, musicObject, getAudioContext, currentTimeA, currentTimeB, durationA, durationB],
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage = { id: crypto.randomUUID(), role: "user", content }
      setLocalMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      try {
        const response = await fetch("/api/grok/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: content,
            audioSnapshot,
            currentTrackA: trackA,
            currentTrackB: trackB,
            musicObject,
            conversationHistory: localMessages.slice(-10),
            availableTracks: tracks,
            audioContext: getAudioContext?.(),
            model: selectedModel,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to get response: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No reader")

        const decoder = new TextDecoder()
        let fullText = ""
        const assistantId = crypto.randomUUID()

        setLocalMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n").filter((line) => line.trim())

          for (const line of lines) {

            if (line.trim() === "[DONE]" || line.trim() === "data: [DONE]") continue

            // Handle AI SDK stream format (0: prefix for text deltas)
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2))
                fullText += text
                setLocalMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)),
                )
              } catch (e) {
                console.error("[GrokChat] Failed to parse 0: line:", e)
              }
            }
            // Handle message content format
            else if (line.startsWith("2:")) {
              try {
                const parsed = JSON.parse(line.slice(2))
                if (parsed.content) {
                  fullText += parsed.content
                  setLocalMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)),
                  )
                }
              } catch (e) {
                console.error("[GrokChat] Failed to parse 2: line:", e)
              }
            }
            // Handle data: prefix format
            else if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim()
              if (jsonStr && jsonStr !== "[DONE]") {
                try {
                  const data = JSON.parse(jsonStr)
                  const content = data.delta || data.choices?.[0]?.delta?.content || data.content || data.text
                  if (content) {
                    fullText += content
                    setLocalMessages((prev) =>
                      prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)),
                    )
                  }
                } catch (e) {
                  console.error("[GrokChat] Failed to parse data line:", e)
                }
              }
            }
            // Try parsing as raw JSON
            else if (line.startsWith("{")) {
              try {
                const data = JSON.parse(line)
                const content = data.delta || data.choices?.[0]?.delta?.content || data.content || data.text
                if (content) {
                  fullText += content
                  setLocalMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)),
                  )
                }
              } catch (e) {
                console.error("[GrokChat] Failed to parse raw JSON:", e)
              }
            }
          }
        }


        // If no text was received, show error
        if (!fullText || fullText.trim().length === 0) {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "I didn't receive a response. Please try again." }
                : m,
            ),
          )
          return
        }

        // Parse for actions
        const jsonMatch = fullText.match(/```json\n?([\s\S]*?)\n?```/)
        if (jsonMatch) {
          try {
            const parsed: ParsedAction = JSON.parse(jsonMatch[1])
            if (parsed.settings) {
              onApplySettings(deepMerge(musicObject, parsed.settings))
            }
            handleAction(parsed)
          } catch (e) {
            console.error("Failed to parse action JSON:", e)
          }
        }
      } catch (error) {
        console.error("Voice command error:", error)
        setLocalMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [
      audioSnapshot,
      trackA,
      trackB,
      musicObject,
      localMessages,
      handleAction,
      onApplySettings,
      tracks,
      getAudioContext,
      selectedModel,
    ],
  )

  const handleVoiceCommand = useCallback(
    (command: string) => {
      sendMessage(command)
    },
    [sendMessage],
  )

  const narrateTransition = useCallback(() => {
    const ctx = getAudioContext?.()
    const camelotA = ctx?.camelotA ?? null
    const camelotB = ctx?.camelotB ?? null
    const energyPhase = ctx?.energyPhase ?? null
    const energyTrend = typeof ctx?.energyTrend === "number" ? ctx.energyTrend : null
    const averageEnergy = typeof ctx?.averageEnergy === "number" ? ctx.averageEnergy : null

    const compat = camelotA && camelotB ? getCamelotCompatibility(camelotA, camelotB) : 0
    const compatLabel = compat >= 0.85 ? "perfect harmonic match"
      : compat >= 0.7 ? "compatible"
      : compat >= 0.5 ? "close enough — riding the filter"
      : compat > 0 ? "enharmonic shift — easing the bass"
      : "key unknown — feeling it out"

    const outDeck: "A" | "B" = isPlayingB && !isPlayingA ? "B"
      : isPlayingA && isPlayingB ? (musicObject.crossfader <= 0.5 ? "A" : "B")
      : "A"
    const inDeck: "A" | "B" = outDeck === "A" ? "B" : "A"
    const outTrack = outDeck === "A" ? trackA : trackB
    const inTrack = inDeck === "A" ? trackA : trackB
    const outStructure = outDeck === "A" ? structureA : structureB
    const inStructure = inDeck === "A" ? structureA : structureB
    const outTime = outDeck === "A" ? currentTimeA : currentTimeB
    const outDur = outDeck === "A" ? durationA : durationB
    const outCamelot = outDeck === "A" ? camelotA : camelotB
    const inCamelot = inDeck === "A" ? camelotA : camelotB

    const exitInfo = outStructure && typeof outTime === "number" && typeof outDur === "number"
      ? findNextExitPoint(outStructure, outTime, outDur)
      : null
    const entryInfo = inStructure ? findBestEntryPoint(inStructure, 16) : null

    const fmtTime = (s?: number) => {
      if (typeof s !== "number" || !isFinite(s)) return "—"
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60).toString().padStart(2, "0")
      return `${m}:${sec}`
    }

    const trendLabel = energyTrend == null ? null
      : energyTrend > 0.06 ? `rising +${Math.round(energyTrend * 100)}%`
      : energyTrend < -0.06 ? `dropping ${Math.round(energyTrend * 100)}%`
      : "steady"

    const lines: string[] = []
    lines.push("▸ scanning the room…")
    if (outTrack) {
      lines.push(`▸ outgoing · deck ${outDeck} · ${outTrack.title}${outCamelot ? ` · ${outCamelot}` : ""}${typeof outTime === "number" ? ` · ${fmtTime(outTime)} of ${fmtTime(outDur)}` : ""}`)
    } else {
      lines.push(`▸ outgoing · deck ${outDeck} · empty`)
    }
    if (inTrack) {
      lines.push(`▸ incoming · deck ${inDeck} · ${inTrack.title}${inCamelot ? ` · ${inCamelot}` : ""}`)
    } else {
      lines.push(`▸ incoming · deck ${inDeck} · empty — picking from library`)
    }
    if (camelotA && camelotB) {
      lines.push(`▸ harmony · ${camelotA} → ${camelotB} · ${compatLabel} (${Math.round(compat * 100)}%)`)
    }
    if (energyPhase) {
      const e = averageEnergy != null ? `${Math.round((averageEnergy / 255) * 100)}%` : ""
      const t = trendLabel ? ` · ${trendLabel}` : ""
      lines.push(`▸ energy · ${energyPhase}${e ? " · " + e : ""}${t}`)
    }
    if (exitInfo && exitInfo.delay > 0.05) {
      lines.push(`▸ exit · ${exitInfo.reason} in ${exitInfo.delay.toFixed(1)}s`)
    } else if (exitInfo) {
      lines.push(`▸ exit · ${exitInfo.reason} now — clean break`)
    } else {
      lines.push("▸ exit · next phrase boundary")
    }
    if (entryInfo && entryInfo.time > 0) {
      const target = entryInfo.targetMoment ? ` (${entryInfo.targetMoment})` : ""
      lines.push(`▸ entry · ${entryInfo.reason} at ${fmtTime(entryInfo.time)}${target}`)
    } else {
      lines.push("▸ entry · first drop")
    }
    lines.push("▸ blend · 16 bars · easing low EQ, opening filter")
    lines.push("▸ cuing the deck… stand by")

    let i = 0
    const tick = () => {
      const line = lines[i]
      if (!line) return
      setLocalMessages((prev) => [
        ...prev,
        { id: `narr-${Date.now()}-${i}`, role: "assistant", content: line },
      ])
      i++
      if (i < lines.length) setTimeout(tick, 320 + Math.random() * 220)
    }
    tick()
  }, [
    getAudioContext, isPlayingA, isPlayingB, musicObject.crossfader,
    trackA, trackB, structureA, structureB,
    currentTimeA, currentTimeB, durationA, durationB,
  ])

  const triggerTransition = useCallback(() => {
    if (isLoading) return
    narrateTransition()
    sendMessage("Create a smooth transition between the two decks")
  }, [isLoading, narrateTransition, sendMessage])

  const { isListening, interimTranscript, error: voiceError, isSupported, toggleListening } = useVoiceCommands({
    onCommand: handleVoiceCommand,
  })

  // Audio analysis — pause when tab is hidden
  useEffect(() => {
    setIsAnalyzing(true)
    let interval: NodeJS.Timeout | null = null

    const start = () => {
      if (interval) return
      interval = setInterval(() => {
        const { frequency } = getAnalyserData()
        const snapshot = analyzeFrequencyData(frequency)
        setAudioSnapshot(snapshot)
      }, 100)
    }

    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
    }

    const onVisibility = () => document.hidden ? stop() : start()
    document.addEventListener("visibilitychange", onVisibility)
    start()

    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
      setIsAnalyzing(false)
    }
  }, [getAnalyserData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localMessages])

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim()) return
    sendMessage(textInput)
    setTextInput("")
  }

  const audioDescription = audioSnapshot ? describeAudioState(audioSnapshot) : "Silence"

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-3 pt-2 pb-3 space-y-2">
          {localMessages.length === 0 && (
            <div className="pt-4 pb-2 space-y-3">
              <p className="text-[10px] font-mono text-violet-300/40 tracking-wide">
                Control the mix with text or voice.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Transition", prompt: "Create a smooth transition between the two decks", narrate: true },
                  { label: "Match BPM", prompt: "Match the BPM of both decks", narrate: false },
                  { label: "Drop bass", prompt: "Drop the bass on deck A", narrate: false },
                  { label: "Boost energy", prompt: "Raise the energy — increase the high EQ and add some reverb", narrate: false },
                ].map(({ label, prompt, narrate }) => (
                  <button
                    key={label}
                    onClick={() => narrate ? triggerTransition() : sendMessage(prompt)}
                    disabled={isLoading}
                    className="px-2 py-2 rounded-lg text-[10px] font-mono text-violet-300/50 hover:text-violet-200/70 bg-violet-500/[0.04] hover:bg-violet-500/[0.08] border border-violet-500/[0.08] hover:border-violet-400/20 disabled:opacity-30 transition-all text-left"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {localMessages.map((message) => (
            <div key={message.id} className={cn("text-[11px] leading-relaxed", message.role === "user" ? "text-right" : "")}>
              {message.role === "user" ? (
                <span className="inline-block px-2.5 py-1.5 rounded-lg bg-violet-500/[0.08] text-white/60 max-w-[85%]">
                  {message.content}
                </span>
              ) : (
                <div className="text-white/55 px-0.5">
                  {message.content.replace(/```json[\s\S]*?```/g, "").trim() || (
                    <span className="text-violet-300/35 italic">Processing...</span>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-1.5 items-center px-0.5 h-5">
              <span className="w-1 h-1 rounded-full bg-violet-400/50 animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-violet-400/50 animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-violet-400/50 animate-bounce [animation-delay:300ms]" />
            </div>
          )}

          {interimTranscript && (
            <div className="text-[11px] text-right">
              <span className="inline-block px-2.5 py-1.5 rounded-lg bg-red-500/[0.06] text-white/40 italic border border-red-500/10">
                {interimTranscript}...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Persistent transition button */}
      <div className="px-2.5 pt-1">
        <button
          onClick={triggerTransition}
          disabled={isLoading}
          className="w-full px-2 py-1.5 rounded-lg text-[10px] font-mono text-violet-300/50 hover:text-violet-200/80 bg-violet-500/[0.06] hover:bg-violet-500/[0.12] border border-violet-500/[0.1] hover:border-violet-400/25 disabled:opacity-30 transition-all"
        >
          Transition
        </button>
      </div>

      {/* Input */}
      <div className="px-2.5 pb-2.5 pt-1.5">
        {voiceError && (
          <p className="text-[10px] text-red-400/60 mb-1.5 px-0.5">{voiceError}</p>
        )}
        {isListening && (
          <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[9px] font-mono text-red-400/60">Listening...</span>
          </div>
        )}
        <form onSubmit={handleTextSubmit} className="flex gap-1.5">
          <button
            type="button"
            onClick={toggleListening}
            disabled={!isSupported}
            aria-label={isListening ? "Stop listening" : "Start voice input"}
            className={cn(
              "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              isListening
                ? "bg-red-500/15 text-red-400"
                : "text-violet-300/25 hover:text-violet-300/45 hover:bg-violet-500/[0.06]",
            )}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <label htmlFor="grok-chat-input" className="sr-only">Chat with AI DJ</label>
          <input
            id="grok-chat-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 h-8 px-2.5 text-[11px] font-mono bg-transparent border border-violet-500/[0.1] rounded-lg text-white/60 placeholder:text-violet-300/35 focus:outline-none focus:border-violet-400/25 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !textInput.trim()}
            aria-label="Send message"
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-violet-300/50 hover:text-violet-200/80 hover:bg-violet-500/[0.08] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            <Send className="h-3 w-3" />
          </button>
        </form>
        {/* Model selector */}
        <div className="flex gap-1.5 mt-1.5 px-0.5">
          {([
            { id: "sonnet" as const, label: "Sonnet" },
            { id: "haiku" as const, label: "Haiku" },
            { id: "grok" as const, label: "Grok" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedModel(id)}
              className={cn(
                "px-2.5 py-1.5 rounded text-[10px] font-mono transition-colors",
                selectedModel === id
                  ? "text-violet-200/70 bg-violet-500/10"
                  : "text-violet-300/40 hover:text-violet-300/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
