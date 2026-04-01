"use client"

import type React from "react"

import { useState, useCallback, useRef, useEffect } from "react"
import { useVoiceCommands } from "@/hooks/use-voice-commands"
import { analyzeFrequencyData, describeAudioState, type AudioSnapshot } from "@/lib/audio-analyzer"
import type { Track, MusicObject } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Mic, MicOff, Volume2, VolumeX, Send, Loader2, Sparkles, AudioWaveform } from "lucide-react"
import { cn } from "@/lib/utils"
import { deepMerge } from "@/lib/utils"

interface VoiceControlProps {
  trackA: Track | null
  trackB: Track | null
  musicObject: MusicObject
  getAnalyserData: () => { frequency: Uint8Array; timeDomain: Uint8Array }
  onApplySettings: (settings: Partial<MusicObject>) => void
  onAction: (action: string, params?: Record<string, unknown>) => void
  onLoadTrack: (track: Track, deck: "A" | "B") => void
  tracks: Track[]
}

interface ParsedAction {
  action: string
  settings?: Partial<MusicObject>
  deck?: "A" | "B" | "both"
  transitionType?: string
  trackId?: string
  trackTitle?: string
}

type GrokVoice = "Ara" | "Rex" | "Sal" | "Eve" | "Una" | "Leo"

export function VoiceControl({
  trackA,
  trackB,
  musicObject,
  getAnalyserData,
  onApplySettings,
  onAction,
  onLoadTrack,
  tracks,
}: VoiceControlProps) {
  const [textInput, setTextInput] = useState("")
  const [audioSnapshot, setAudioSnapshot] = useState<AudioSnapshot | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analyzeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [localMessages, setLocalMessages] = useState<Array<{ id: string; role: string; content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [grokVoice, setGrokVoice] = useState<GrokVoice>("Ara")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const speakText = useCallback(
    async (text: string) => {
      if (!ttsEnabled || !text.trim()) return

      // Clean the text - remove JSON blocks and markdown
      const cleanText = text
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\*\*/g, "")
        .replace(/\n+/g, " ")
        .trim()

      if (!cleanText || cleanText.length < 3) return

      try {
        setIsSpeaking(true)

        const response = await fetch("/api/grok/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, voice: grokVoice }),
        })

        if (!response.ok) throw new Error("TTS failed")

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        // Stop any existing audio
        if (audioRef.current) {
          audioRef.current.pause()
          URL.revokeObjectURL(audioRef.current.src)
        }

        // Play new audio
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }

        audio.onerror = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }

        await audio.play()
      } catch (error) {
        console.error("TTS error:", error)
        setIsSpeaking(false)
      }
    },
    [ttsEnabled, grokVoice],
  )

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsSpeaking(false)
    }
  }, [])

  const handleAction = useCallback(
    (parsed: ParsedAction) => {
      switch (parsed.action) {
        case "mixer":
          if (parsed.settings) {
            onApplySettings(parsed.settings)
          }
          break
        case "loadTrack":
          // Find track by ID or partial title match
          const track = tracks.find(t => 
            t.id === parsed.trackId || 
            (parsed.trackTitle && t.title.toLowerCase().includes(parsed.trackTitle.toLowerCase()))
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
            
            console.log(`[VoiceControl] Loading "${track.title}" to deck ${targetDeck}`)
            onLoadTrack(track, targetDeck)
            // Auto-play after loading
            setTimeout(() => onAction("play", { deck: targetDeck }), 500)
          } else {
            console.warn("[VoiceControl] Track not found:", parsed.trackId || parsed.trackTitle)
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
        case "transition":
          onAction("transition", { type: parsed.transitionType })
          break
      }
    },
    [onApplySettings, onAction, onLoadTrack, tracks],
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
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[VoiceControl] Error:", response.status, errorText)
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
          const lines = chunk.split("\n").filter(line => line.trim())
          
          for (const line of lines) {
            
            // Skip [DONE] marker
            if (line.trim() === "[DONE]" || line.trim() === "data: [DONE]") {
              console.log("[VoiceControl] Stream done marker received")
              continue
            }
            
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2))
                fullText += text
                setLocalMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)))
              } catch (e) {
                // Ignore parse errors
              }
            } 
            else if (line.startsWith("8:")) {
              console.error("[VoiceControl] Error from stream:", line.slice(2))
            }
            else if (line.startsWith("2:")) {
              try {
                const parsed = JSON.parse(line.slice(2))
                if (parsed.content) {
                  fullText += parsed.content
                  setLocalMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)))
                }
              } catch (e) {
                // Ignore
              }
            }
            else if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim()
              if (jsonStr && jsonStr !== "[DONE]") {
                try {
                  const data = JSON.parse(jsonStr)
                  const content = data.delta || data.choices?.[0]?.delta?.content || data.content || data.text
                  if (content) {
                    fullText += content
                    setLocalMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)))
                  }
                } catch (e) {
                  // Ignore
                }
              }
            } 
            else if (line.startsWith("{")) {
              try {
                const data = JSON.parse(line)
                const content = data.delta || data.choices?.[0]?.delta?.content || data.content || data.text
                if (content) {
                  fullText += content
                  setLocalMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)))
                }
              } catch (e) {
                // Ignore
              }
            }
          }
        }

        // Parse response for actions
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
        } else {
          
          // Fallback: Try to parse common commands from text
          const lowerText = fullText.toLowerCase()
          let fallbackSettings: any = {}
          let fallbackAction: ParsedAction | null = null
          
          // Track loading/playing - check for "play [song name]" or "load [song name]"
          const playTrackMatch = lowerText.match(/(?:play|load|put on)\s+["']?([^"'\n]+?)["']?(?:\s+(?:on|to|in)\s+deck\s+(a|b))?$/i)
          if (playTrackMatch && tracks.length > 0) {
            const songQuery = playTrackMatch[1].trim()
            const specifiedDeck = playTrackMatch[2]?.toUpperCase() as "A" | "B" | undefined
            
            // Try to find a track by partial name match
            const trackMatch = tracks.find(t => 
              t.title.toLowerCase().includes(songQuery) ||
              songQuery.includes(t.title.toLowerCase())
            )
            
            if (trackMatch) {
              console.log(`[VoiceControl] Fallback: Loading "${trackMatch.title}"`)
              fallbackAction = { 
                action: "loadTrack", 
                trackId: trackMatch.id,
                trackTitle: trackMatch.title,
                deck: specifiedDeck 
              }
            } else if (songQuery.length > 2) {
              // Try fuzzy match - find track where any word matches
              const words = songQuery.split(/\s+/)
              const fuzzyMatch = tracks.find(t => 
                words.some(word => word.length > 2 && t.title.toLowerCase().includes(word))
              )
              if (fuzzyMatch) {
                console.log(`[VoiceControl] Fallback fuzzy: Loading "${fuzzyMatch.title}"`)
                fallbackAction = { 
                  action: "loadTrack", 
                  trackId: fuzzyMatch.id,
                  trackTitle: fuzzyMatch.title,
                  deck: specifiedDeck 
                }
              }
            }
          }
          
          // Play/Pause
          if (lowerText.match(/\b(play|start)\b/) && !fallbackAction) {
            fallbackAction = { action: "play" }
          } else if (lowerText.match(/\b(pause|stop)\b/) && !fallbackAction) {
            fallbackAction = { action: "pause" }
          }
          
          // Bass controls
          if (lowerText.match(/\b(more|add|boost|increase|pump|up)\b.*\bbass\b|\bbass\b.*(more|add|boost|increase|pump|up)\b/)) {
            fallbackSettings.eq = { ...musicObject.eq, low: 5 }
          } else if (lowerText.match(/\b(less|cut|reduce|lower|decrease|down)\b.*\bbass\b|\bbass\b.*(less|cut|reduce|lower|decrease|down)\b/)) {
            fallbackSettings.eq = { ...musicObject.eq, low: -5 }
          }
          
          // Highs controls
          if (lowerText.match(/\b(more|add|boost|increase|brighten)\b.*\b(high|highs|treble)\b|\b(high|highs|treble)\b.*(more|add|boost|increase)\b/)) {
            fallbackSettings.eq = { ...fallbackSettings.eq, ...musicObject.eq, high: 4 }
          } else if (lowerText.match(/\b(less|cut|reduce|lower)\b.*\b(high|highs|treble)\b|\b(high|highs|treble)\b.*(less|cut|reduce|lower)\b/)) {
            fallbackSettings.eq = { ...fallbackSettings.eq, ...musicObject.eq, high: -4 }
          }
          
          // Filter controls
          if (lowerText.match(/\bfilter\b.*(drop|down|close|lower|cut)|\b(drop|down|close|lower|cut)\b.*\bfilter\b/)) {
            fallbackSettings.filter = { ...musicObject.filter, cutoff: 800 }
          } else if (lowerText.match(/\bfilter\b.*(open|up|raise|lift)|\b(open|up|raise|lift)\b.*\bfilter\b/)) {
            fallbackSettings.filter = { ...musicObject.filter, cutoff: 18000 }
          }
          
          // Effects
          if (lowerText.match(/\b(add|more|some)\b.*\breverb\b|\breverb\b/)) {
            fallbackSettings.reverbAmount = 0.4
          }
          
          if (lowerText.match(/\b(add|more|some)\b.*\b(delay|echo)\b|\b(delay|echo)\b/)) {
            fallbackSettings.delayAmount = 0.4
          }
          
          // Crossfader
          if (lowerText.match(/\b(fade|cross|switch|go)\b.*(to\s+)?(deck\s+)?b\b|\bb\b.*(fade|cross)/)) {
            fallbackSettings.crossfader = 1
          } else if (lowerText.match(/\b(fade|cross|switch|go)\b.*(to\s+)?(deck\s+)?a\b|\ba\b.*(fade|cross)/)) {
            fallbackSettings.crossfader = 0
          }
          
          if (fallbackAction) {
            handleAction(fallbackAction)
          }
          
          if (Object.keys(fallbackSettings).length > 0) {
            onApplySettings(fallbackSettings)
          }
        }

        speakText(fullText)
      } catch (error) {
        console.error("Voice command error:", error)
        setLocalMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: "Sorry, I encountered an error. Please try again." },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [audioSnapshot, trackA, trackB, musicObject, localMessages, handleAction, speakText, onApplySettings, tracks],
  )

  const handleVoiceCommand = useCallback(
    (command: string) => {
      sendMessage(command)
    },
    [sendMessage],
  )

  const {
    isListening,
    interimTranscript,
    error: voiceError,
    isSupported,
    toggleListening,
  } = useVoiceCommands({
    onCommand: handleVoiceCommand,
  })

  // Audio analysis loop
  const startAudioAnalysis = useCallback(() => {
    if (analyzeIntervalRef.current) return
    setIsAnalyzing(true)

    analyzeIntervalRef.current = setInterval(() => {
      const { frequency } = getAnalyserData()
      const snapshot = analyzeFrequencyData(frequency)
      setAudioSnapshot(snapshot)
    }, 100)
  }, [getAnalyserData])

  const stopAudioAnalysis = useCallback(() => {
    if (analyzeIntervalRef.current) {
      clearInterval(analyzeIntervalRef.current)
      analyzeIntervalRef.current = null
    }
    setIsAnalyzing(false)
  }, [])

  useEffect(() => {
    startAudioAnalysis()
    return () => stopAudioAnalysis()
  }, [startAudioAnalysis, stopAudioAnalysis])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localMessages])

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim()) return
    sendMessage(textInput)
    setTextInput("")
  }

  const audioDescription = audioSnapshot ? describeAudioState(audioSnapshot) : "No audio"

  return (
    <div className="flex flex-col h-full bg-[#150535] rounded-2xl border border-violet-500/[0.12] shadow-[0_0_30px_rgba(185,103,255,0.08)] overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-violet-500/[0.1]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Sparkles className="h-4 w-4 text-fuchsia-400" />
              <div className="absolute inset-0 animate-pulse">
                <Sparkles className="h-4 w-4 text-fuchsia-400 opacity-50" />
              </div>
            </div>
            <h2 className="text-sm font-semibold text-violet-100">Voice Control</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking()
                } else {
                  setTtsEnabled(!ttsEnabled)
                }
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] transition-colors",
                isSpeaking
                  ? "bg-fuchsia-500/30 text-fuchsia-400 animate-pulse"
                  : ttsEnabled
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-violet-500/[0.08] text-violet-100/35",
              )}
              title={isSpeaking ? "Click to stop" : ttsEnabled ? "TTS enabled" : "TTS disabled"}
            >
              {ttsEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              <span>{isSpeaking ? "Speaking..." : "TTS"}</span>
            </button>

            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px]",
                isAnalyzing ? "bg-cyan-500/20 text-cyan-400" : "bg-violet-500/[0.08] text-violet-100/35",
              )}
            >
              <AudioWaveform className="h-3 w-3" />
              <span>Audio</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-violet-100/35">Voice:</span>
          <div className="flex gap-1">
            {(["Ara", "Rex", "Eve", "Leo"] as GrokVoice[]).map((voice) => (
              <button
                key={voice}
                onClick={() => setGrokVoice(voice)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] transition-colors",
                  grokVoice === voice
                    ? "bg-cyan-500/30 text-cyan-400 border border-cyan-500/50"
                    : "bg-violet-500/[0.06] text-violet-100/35 hover:text-violet-100/70",
                )}
              >
                {voice}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-violet-100/40 bg-violet-500/[0.06] rounded px-2 py-1">
          <span className="text-fuchsia-400">Hearing:</span> {audioDescription}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3 h-full overflow-y-auto">
        <div className="space-y-3">
          {localMessages.length === 0 && (
            <div className="text-center py-8 text-violet-100/35 text-xs">
              <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Click the mic or type to talk to Grok.</p>
              <p className="mt-1 text-violet-100/25">Grok will speak responses aloud!</p>
            </div>
          )}

          {localMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "p-2 rounded-lg text-xs",
                message.role === "user"
                  ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 ml-8"
                  : "bg-violet-500/[0.06] border border-violet-500/[0.1] text-violet-100/70 mr-8",
              )}
            >
              {message.role === "assistant" ? (
                <div className="whitespace-pre-wrap">{message.content.replace(/```json[\s\S]*?```/g, "").trim()}</div>
              ) : (
                message.content
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-violet-100/40 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Grok is thinking...</span>
            </div>
          )}

          {interimTranscript && (
            <div className="p-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-100/90 text-xs italic ml-8">
              {interimTranscript}...
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-violet-500/[0.1] space-y-2">
        {voiceError && <p className="text-xs text-red-400">{voiceError}</p>}

        <div className="flex gap-2">
          <Button
            onClick={toggleListening}
            disabled={!isSupported}
            variant="outline"
            size="icon"
            className={cn(
              "shrink-0 transition-all",
              isListening
                ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse"
                : "border-violet-500/[0.15] text-violet-100/40 hover:text-fuchsia-400 hover:border-fuchsia-500/50",
            )}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>

          <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a command..."
              className="flex-1 bg-violet-500/[0.06] border-violet-500/[0.12] text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !textInput.trim()}
              className="shrink-0 bg-gradient-to-r from-fuchsia-600 to-cyan-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap gap-1">
          {["More bass", "Drop filter", "Fade to B", "Play", "Add reverb"].map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendMessage(cmd)}
              disabled={isLoading}
              className="px-2 py-0.5 rounded text-[10px] bg-violet-500/[0.06] text-violet-100/40 hover:text-fuchsia-400 hover:bg-violet-500/[0.08] transition-colors disabled:opacity-50"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
