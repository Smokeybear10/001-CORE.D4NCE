"use client"

import { useState } from "react"
import type { Track, MusicObject, TransitionPlan, Preset, TrackRecommendation } from "@/lib/types"
import type { SongStructure } from "@/lib/song-structure"
import type { TransitionState } from "@/lib/music-engine"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles, Wand2, Lightbulb, Music2, Loader2, ArrowRight, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { TransitionStatus } from "./transition-status"

interface GrokCopilotProps {
  trackA: Track | null
  trackB: Track | null
  musicObject: MusicObject
  tracks: Track[]
  transitionState?: TransitionState
  onApplyTransition: (plan: TransitionPlan) => void
  onApplyPreset: (preset: Partial<MusicObject>) => void
  onLoadTrack: (track: Track, deck: "A" | "B") => void
  onCancelTransition?: () => void
  currentTimeA?: number
  currentTimeB?: number
  durationA?: number
  durationB?: number
  isPlayingA?: boolean
  isPlayingB?: boolean
  structureA?: SongStructure | null
  structureB?: SongStructure | null
  getAudioContext?: () => {
    summary?: string
    energyPhase?: string
    averageEnergy?: number
    energyTrend?: number
    camelotA?: string | null
    camelotB?: string | null
  }
}

interface CoachMessage {
  id: string
  message: string
  type: "info" | "tip" | "action"
  timestamp: Date
}

export function GrokCopilot({
  trackA,
  trackB,
  musicObject,
  tracks,
  transitionState,
  onApplyTransition,
  onApplyPreset,
  onLoadTrack,
  onCancelTransition,
  currentTimeA,
  currentTimeB,
  durationA,
  durationB,
  isPlayingA,
  isPlayingB,
  structureA,
  structureB,
  getAudioContext,
}: GrokCopilotProps) {
  const [transitionPrompt, setTransitionPrompt] = useState("")
  const [presetPrompt, setPresetPrompt] = useState("")
  const [isGeneratingTransition, setIsGeneratingTransition] = useState(false)
  const [isGeneratingPreset, setIsGeneratingPreset] = useState(false)
  const [isRecommending, setIsRecommending] = useState(false)
  const [recommendations, setRecommendations] = useState<TrackRecommendation[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([])
  const [lastTransitionPlan, setLastTransitionPlan] = useState<TransitionPlan | null>(null)

  const addCoachMessage = (message: string, type: "info" | "tip" | "action" = "info") => {
    setCoachMessages((prev) =>
      [
        ...prev,
        {
          id: crypto.randomUUID(),
          message,
          type,
          timestamp: new Date(),
        },
      ].slice(-20),
    )
  }

  const generateTransition = async () => {
    if (!trackA || !trackB) {
      addCoachMessage("Load tracks into both decks to plan a transition.", "tip")
      return
    }

    setIsGeneratingTransition(true)
    addCoachMessage(`Planning transition from "${trackA.title}" to "${trackB.title}"...`, "action")

    try {
      // Determine which deck is outgoing based on playback state
      const outgoingDeck = isPlayingB && !isPlayingA ? "B"
        : isPlayingA && isPlayingB ? (musicObject.crossfader <= 0.5 ? "A" : "B")
        : "A"

      const outStructure = outgoingDeck === "A" ? structureA : structureB
      const inStructure = outgoingDeck === "A" ? structureB : structureA
      const response = await fetch("/api/grok/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackA,
          trackB,
          currentMusicObject: musicObject,
          userPrompt: transitionPrompt || undefined,
          currentTimeA,
          durationA,
          currentTimeB,
          durationB,
          outgoingDeck,
          audioContext: getAudioContext?.(),
          outgoingStructure: outStructure ?? undefined,
          incomingStructure: inStructure ?? undefined,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate transition")

      const { plan } = await response.json()
      setLastTransitionPlan(plan)
      if (plan.explanation) {
        addCoachMessage(plan.explanation, "info")
      }
    } catch (error) {
      addCoachMessage("Failed to generate transition plan. Please try again.", "tip")
    } finally {
      setIsGeneratingTransition(false)
    }
  }

  const generatePreset = async () => {
    if (!presetPrompt.trim()) {
      addCoachMessage("Describe the vibe you want to create.", "tip")
      return
    }

    setIsGeneratingPreset(true)
    addCoachMessage(`Creating preset: "${presetPrompt}"...`, "action")

    try {
      const response = await fetch("/api/grok/preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: presetPrompt }),
      })

      if (!response.ok) throw new Error("Failed to generate preset")

      const { preset, explanation } = await response.json()
      setPresets((prev) => [preset, ...prev])
      addCoachMessage(explanation, "info")
      setPresetPrompt("")
    } catch (error) {
      addCoachMessage("Failed to generate preset. Please try again.", "tip")
    } finally {
      setIsGeneratingPreset(false)
    }
  }

  const getRecommendations = async () => {
    const currentTrack = trackA || trackB
    if (!currentTrack) {
      addCoachMessage("Load a track to get recommendations.", "tip")
      return
    }

    if (tracks.length < 2) {
      addCoachMessage("Add more tracks to your library for recommendations.", "tip")
      return
    }

    setIsRecommending(true)
    addCoachMessage("Finding the best next tracks...", "action")

    try {
      const response = await fetch("/api/grok/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentTrack,
          library: tracks,
        }),
      })

      if (!response.ok) throw new Error("Failed to get recommendations")

      const data = await response.json()
      setRecommendations(data.recommendations || [])
      if (data.explanation) {
        addCoachMessage(data.explanation, "info")
      }
    } catch (error) {
      addCoachMessage("Failed to get recommendations. Please try again.", "tip")
    } finally {
      setIsRecommending(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#150535] rounded-2xl border border-violet-500/[0.12] shadow-[0_0_30px_rgba(185,103,255,0.08)] overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-violet-500/[0.1] flex items-center gap-2">
        <div className="relative">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <div className="absolute inset-0 animate-pulse">
            <Sparkles className="h-4 w-4 text-violet-300 opacity-50" />
          </div>
        </div>
        <h2 className="text-sm font-semibold text-violet-100">Grok Co-Pilot</h2>
      </div>

      <Tabs defaultValue="transitions" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-3 mt-2 bg-violet-500/[0.06]">
          <TabsTrigger value="transitions" className="text-xs">
            Transitions
          </TabsTrigger>
          <TabsTrigger value="presets" className="text-xs">
            Presets
          </TabsTrigger>
          <TabsTrigger value="recommend" className="text-xs">
            Recommend
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-xs">
            Coach
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transitions" className="flex-1 p-3 overflow-auto">
          <div className="space-y-3">
            {/* Show active transition status */}
            {transitionState?.isActive && onCancelTransition && (
              <TransitionStatus transitionState={transitionState} onCancel={onCancelTransition} />
            )}

            <div className="text-xs text-violet-200/35">Plan an AI-powered transition between your loaded tracks.</div>

            <div className="flex items-center gap-2 text-xs">
              <div
                className={cn(
                  "px-2 py-1 rounded bg-violet-500/15 text-violet-200 truncate max-w-[100px]",
                  !trackA && "opacity-50",
                )}
              >
                {trackA?.title || "Deck A"}
              </div>
              <ArrowRight className="h-3 w-3 text-violet-200/30" />
              <div
                className={cn(
                  "px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 truncate max-w-[100px]",
                  !trackB && "opacity-50",
                )}
              >
                {trackB?.title || "Deck B"}
              </div>
            </div>

            <Textarea
              value={transitionPrompt}
              onChange={(e) => setTransitionPrompt(e.target.value)}
              placeholder="Describe the transition (optional)... e.g., 'smooth 16 bar blend' or 'aggressive drop'"
              className="h-20 text-xs bg-violet-500/[0.06] border-white/[0.10] resize-none"
            />

            <Button
              onClick={generateTransition}
              disabled={isGeneratingTransition || !trackA || !trackB}
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500"
            >
              {isGeneratingTransition ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Plan Transition
            </Button>

            {lastTransitionPlan && (
              <div className="p-3 rounded-lg bg-violet-500/[0.06] border border-violet-500/15">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-violet-200">Transition Plan</p>
                  <span className="text-xs text-violet-200/35">{lastTransitionPlan.durationSeconds}s</span>
                </div>
                {lastTransitionPlan.explanation && (
                  <p className="text-xs text-violet-100/65 mb-3">{lastTransitionPlan.explanation}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onApplyTransition(lastTransitionPlan)}
                    className="flex-1 text-xs bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Apply Transition
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="presets" className="flex-1 p-3 overflow-hidden flex flex-col">
          <div className="space-y-3 mb-3">
            <div className="text-xs text-violet-200/35">Describe a vibe and let Grok create mixer settings.</div>

            <Textarea
              value={presetPrompt}
              onChange={(e) => setPresetPrompt(e.target.value)}
              placeholder="e.g., 'Cyberpunk synthwave, heavy bass, 115 BPM, cinematic buildup'"
              className="h-20 text-xs bg-violet-500/[0.06] border-white/[0.10] resize-none"
            />

            <Button
              onClick={generatePreset}
              disabled={isGeneratingPreset || !presetPrompt.trim()}
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500"
            >
              {isGeneratingPreset ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Preset
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-2 rounded-lg bg-violet-500/[0.06] border border-violet-500/[0.1] hover:border-violet-400/25 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-violet-100">{preset.name}</p>
                      <p className="text-[10px] text-violet-200/35">{preset.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onApplyPreset(preset.musicObject)}
                      className="h-6 px-2 text-xs"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recommend" className="flex-1 p-3 overflow-hidden flex flex-col">
          <div className="space-y-3 mb-3">
            <div className="text-xs text-violet-200/35">Get AI recommendations for your next track.</div>

            <Button
              onClick={getRecommendations}
              disabled={isRecommending || (!trackA && !trackB)}
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500"
            >
              {isRecommending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Music2 className="h-4 w-4 mr-2" />}
              Find Next Tracks
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {recommendations.map((rec) => {
                const track = tracks.find((t) => t.id === rec.trackId)
                if (!track) return null

                return (
                  <div key={rec.trackId} className="p-2 rounded-lg bg-violet-500/[0.06] border border-violet-500/[0.1]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-xs font-medium text-violet-100">{track.title}</p>
                        <p className="text-[10px] text-violet-200/35">{track.artist}</p>
                      </div>
                      <div className="text-[10px] text-cyan-400/90">{Math.round(rec.compatibilityScore * 100)}%</div>
                    </div>
                    <p className="text-[10px] text-violet-100/65 mb-2">{rec.reason}</p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onLoadTrack(track, "A")}
                        className="h-5 px-2 text-[10px] text-violet-300"
                      >
                        Load A
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onLoadTrack(track, "B")}
                        className="h-5 px-2 text-[10px] text-cyan-400"
                      >
                        Load B
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="coach" className="flex-1 p-3 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {coachMessages.length === 0 ? (
                <div className="text-center py-8 text-violet-200/30 text-xs">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  DJ tips and explanations will appear here as you use the system.
                </div>
              ) : (
                coachMessages
                  .slice()
                  .reverse()
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "p-2 rounded-lg text-xs",
                        msg.type === "tip" && "bg-violet-500/10 border border-violet-500/15 text-violet-100/85",
                        msg.type === "action" && "bg-cyan-500/10 border border-cyan-500/20 text-cyan-100/90",
                        msg.type === "info" && "bg-violet-500/[0.06] border border-violet-500/[0.1] text-violet-100/65",
                      )}
                    >
                      {msg.message}
                    </div>
                  ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
