"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import { useVoiceCommands } from "@/hooks/use-voice-commands"
import { analyzeFrequencyData, describeAudioState, type AudioSnapshot } from "@/lib/audio-analyzer"
import type { Track, MusicObject, TransitionPlan } from "@/lib/types"
import type { SongStructure } from "@/lib/song-structure"
import { structureToPromptText, findNextExitPoint, findBestEntryPoint } from "@/lib/song-structure"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic, MicOff, Send, Loader2, Sparkles } from "lucide-react"
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
                console.log(`[GrokChat] Loading "${track.title}" for transition`)
                
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
                      console.log("[GrokChat] Requesting transition after loading track")
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
                          currentTimeA,
                          durationA,
                          currentTimeB,
                          durationB,
                          outgoingDeck: outDeck,
                          audioContext: getAudioContext?.(),
                          outgoingStructure: outStructure ?? undefined,
                          incomingStructure: inStructure ?? undefined,
                          model: selectedModel,
                        }),
                      })

                      if (response.ok) {
                        const { plan } = await response.json()
                        console.log("[GrokChat] Received transition plan:", plan)
                        onApplyTransition(plan)
                      }
                    } catch (error) {
                      console.error("[GrokChat] Error requesting transition:", error)
                    }
                  }
                }, 1000) // Wait 1 second for track to load
              } else {
                console.warn("[GrokChat] Track not found for transition:", parsed.trackTitle || parsed.trackId)
              }
            } else {
              // Normal transition between currently loaded tracks
              if (trackA && trackB) {
                try {
                  console.log("[GrokChat] Requesting transition between loaded tracks")
                  const outDeck2: "A" | "B" = isPlayingB && !isPlayingA ? "B"
                    : isPlayingA && isPlayingB ? (musicObject.crossfader <= 0.5 ? "A" : "B")
                    : "A"
                  const outStr = outDeck2 === "A" ? structureA : structureB
                  const inStr = outDeck2 === "A" ? structureB : structureA
                  const response = await fetch("/api/grok/transition", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      trackA,
                      trackB,
                      currentMusicObject: musicObject,
                      userPrompt: parsed.transitionType || "smooth transition",
                      currentTimeA,
                      durationA,
                      currentTimeB,
                      durationB,
                      outgoingDeck: outDeck2,
                      audioContext: getAudioContext?.(),
                      outgoingStructure: outStr ?? undefined,
                      incomingStructure: inStr ?? undefined,
                      model: selectedModel,
                    }),
                  })

                  if (response.ok) {
                    const { plan } = await response.json()
                    console.log("[GrokChat] Received transition plan:", plan)
                    onApplyTransition(plan)
                  } else {
                    console.error("[GrokChat] Failed to get transition plan")
                  }
                } catch (error) {
                  console.error("[GrokChat] Error requesting transition:", error)
                }
              } else {
                console.warn("[GrokChat] Cannot transition - missing tracks")
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
            
            console.log(`[GrokChat] Loading "${track.title}" to deck ${targetDeck}`)
            onLoadTrack(track, targetDeck)
            // Auto-play after loading (give time for track to load)
            setTimeout(() => onAction("play", { deck: targetDeck }), 500)
          } else {
            console.warn("[GrokChat] Track not found:", parsed.trackId || parsed.trackTitle)
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
            console.log("[GrokChat] Stream line:", line)

            if (line.trim() === "[DONE]" || line.trim() === "data: [DONE]") continue

            // Handle AI SDK stream format (0: prefix for text deltas)
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2))
                console.log("[GrokChat] Text delta:", text)
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
                console.log("[GrokChat] Message object:", parsed)
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
                  console.log("[GrokChat] Data object:", data)
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
                console.log("[GrokChat] Raw JSON object:", data)
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

        console.log("[GrokChat] Final text:", fullText)

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

  const { isListening, interimTranscript, error: voiceError, isSupported, toggleListening } = useVoiceCommands({
    onCommand: handleVoiceCommand,
  })

  // Audio analysis
  useEffect(() => {
    setIsAnalyzing(true)
    const interval = setInterval(() => {
      const { frequency } = getAnalyserData()
      const snapshot = analyzeFrequencyData(frequency)
      setAudioSnapshot(snapshot)
    }, 100)

    return () => {
      clearInterval(interval)
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

  const samplePrompts = [
    { label: "Match tempos", prompt: "Match the BPM of both decks" },
    { label: "Drop the bass", prompt: "Drop the bass on deck A" },
    { label: "Boost energy", prompt: "Raise the energy — increase the high EQ and add some reverb" },
  ]

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#150535] border border-violet-500/[0.1] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-500/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center",
            isListening ? "bg-red-500/20" : "bg-fuchsia-500/15",
          )}>
            <Sparkles className={cn("h-3 w-3", isListening ? "text-red-400" : "text-fuchsia-400")} />
          </div>
          {isListening && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Listening
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {([
            { id: "sonnet" as const, label: "Sonnet" },
            { id: "haiku" as const, label: "Haiku" },
            { id: "grok" as const, label: "Grok" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedModel(id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors",
                selectedModel === id
                  ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
                  : "text-violet-200/30 hover:text-violet-200/50 border border-transparent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {localMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-8 pb-2">
              <button
                onClick={toggleListening}
                disabled={!isSupported}
                className={cn(
                  "w-14 h-14 mb-3 rounded-full flex items-center justify-center transition-all border",
                  isListening
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-pink-500/10 border-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/15 hover:border-fuchsia-500/30",
                )}
              >
                <Mic className="h-6 w-6" />
              </button>
              <p className="text-[11px] text-violet-200/25 tracking-wide">Ask Grok to control the mix</p>
            </div>
          )}

          {localMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2.5 items-end",
                message.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5",
                message.role === "user" ? "bg-violet-500/10" : "bg-fuchsia-500/15",
              )}>
                {message.role === "user"
                  ? <Mic className="h-3 w-3 text-violet-200/50" />
                  : <Sparkles className="h-3 w-3 text-fuchsia-400" />
                }
              </div>

              <div className={cn(
                "px-3 py-2 rounded-xl text-[12px] leading-relaxed max-w-[78%]",
                message.role === "user"
                  ? "bg-violet-500/[0.08] text-white/80 rounded-br-sm"
                  : "bg-fuchsia-500/[0.08] border border-fuchsia-500/[0.12] text-white/70 rounded-bl-sm",
              )}>
                {message.role === "assistant"
                  ? message.content.replace(/```json[\s\S]*?```/g, "").trim()
                  : message.content
                }
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-end gap-2.5">
              <div className="w-6 h-6 rounded-full bg-fuchsia-500/15 flex items-center justify-center shrink-0">
                <Loader2 className="h-3 w-3 text-fuchsia-400 animate-spin" />
              </div>
              <div className="px-3 py-2 bg-fuchsia-500/[0.08] border border-fuchsia-500/[0.12] rounded-xl rounded-bl-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1 h-1 rounded-full bg-fuchsia-400/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-fuchsia-400/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-fuchsia-400/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {interimTranscript && (
            <div className="flex items-end gap-2.5 flex-row-reverse">
              <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Mic className="h-3 w-3 text-red-400" />
              </div>
              <div className="px-3 py-2 bg-violet-500/[0.06] border border-violet-500/[0.1] rounded-xl rounded-br-sm text-[12px] text-white/40 italic max-w-[78%]">
                {interimTranscript}…
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Sample prompts — always visible */}
      <div className="px-3 pt-2.5 pb-2 border-t border-violet-500/[0.06] flex flex-col gap-2">
        {/* Primary CTA */}
        <button
          onClick={() => sendMessage("Create a smooth transition between the two decks")}
          disabled={isLoading}
          className="w-full py-2 rounded-lg text-[12px] font-semibold bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 hover:text-fuchsia-200 border border-fuchsia-500/25 hover:border-fuchsia-500/50 disabled:opacity-40 transition-all"
        >
          Smooth Transition
        </button>
        {/* Secondary chips */}
        <div className="flex flex-wrap gap-1.5">
          {samplePrompts.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-md text-[10px] bg-violet-500/[0.06] text-white/35 hover:bg-violet-500/[0.08] hover:text-white/60 border border-white/[0.05] hover:border-fuchsia-500/20 disabled:opacity-40 transition-all"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-violet-500/[0.06] p-3">
        {voiceError && (
          <p className="text-[11px] text-red-400/70 mb-2 px-1">{voiceError}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={toggleListening}
            disabled={!isSupported}
            className={cn(
              "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
              isListening
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-violet-500/[0.06] border-white/[0.06] text-violet-200/30 hover:text-violet-200/50 hover:bg-white/[0.06]",
            )}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask Grok anything..."
              className="flex-1 h-9 px-3 text-[12px] bg-violet-500/[0.06] border border-violet-500/[0.1] rounded-xl text-white/70 placeholder:text-white/20 focus:outline-none focus:border-fuchsia-500/30 transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !textInput.trim()}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-fuchsia-500/15 border border-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
