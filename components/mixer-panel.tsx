"use client"

import { useState } from "react"
import type { MusicObject } from "@/lib/types"
import type { TransitionState } from "@/lib/music-engine"
import { Slider } from "@/components/ui/slider"
import { Shuffle, Volume2, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MixerPanelProps {
  musicObject: MusicObject
  transitionState: TransitionState
  bpmA: number | null
  bpmB: number | null
  camelotA?: string | null
  camelotB?: string | null
  keyCompatibility?: number | null
  onCrossfadeChange: (value: number) => void
  onEQChange: (band: "low" | "mid" | "high", value: number) => void
  onFilterChange: (cutoff: number) => void
  onReverbChange: (value: number) => void
  onDelayChange: (value: number) => void
  onMasterGainChange: (value: number) => void
  onIsolationChange: (deck: "A" | "B", type: "bass" | "voice" | "melody", value: number) => void
  onFXChange: (param: string, value: number) => void
  onPerDeckEQChange: (deck: "A" | "B", band: "low" | "mid" | "high", value: number) => void
  onTransition: () => void
  onCancelTransition: () => void
  trackALoaded: boolean
  trackBLoaded: boolean
}

type MixerTab = "eq" | "fx" | "iso" | "deck"

function Label({ children, color }: { children: React.ReactNode; color?: "a" | "b" }) {
  return (
    <span className={cn(
      "text-[10px] font-mono uppercase tracking-[0.12em]",
      color === "a" ? "text-fuchsia-400/60" : color === "b" ? "text-cyan-400/60" : "text-violet-300/45",
    )}>
      {children}
    </span>
  )
}

function Val({ children, active, color }: { children: React.ReactNode; active?: boolean; color?: "a" | "b" }) {
  return (
    <span className={cn(
      "text-[10px] font-mono tabular-nums",
      active
        ? color === "a" ? "text-fuchsia-400/80" : color === "b" ? "text-cyan-400/80" : "text-amber-200/70"
        : "text-violet-300/35",
    )}>
      {children}
    </span>
  )
}

export function MixerPanel({
  musicObject, transitionState,
  bpmA, bpmB, camelotA, camelotB,
  onCrossfadeChange, onEQChange, onFilterChange,
  onReverbChange, onDelayChange, onMasterGainChange,
  onIsolationChange, onFXChange, onPerDeckEQChange,
  onTransition, onCancelTransition,
  trackALoaded, trackBLoaded,
}: MixerPanelProps) {
  const [tab, setTab] = useState<MixerTab>("eq")
  const [collapsed, setCollapsed] = useState(false)
  const crossfader = musicObject.crossfader ?? 0.5

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-25 flex h-16 w-5 items-center justify-center rounded-r-lg bg-[#150535]/90 border border-l-0 border-violet-500/[0.12] shadow-[0_0_20px_rgba(185,103,255,0.06)] text-violet-300/20 hover:text-violet-300/40 transition-all"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    )
  }

  const tabs: { id: MixerTab; label: string }[] = [
    { id: "eq", label: "EQ" },
    { id: "fx", label: "FX" },
    { id: "iso", label: "ISO" },
    { id: "deck", label: "A|B" },
  ]

  return (
    <aside className="absolute left-2 top-[52px] bottom-[56px] z-25 flex w-[200px] flex-col bg-[#150535]/90 backdrop-blur-md rounded-2xl border border-violet-500/[0.12] shadow-[0_0_30px_rgba(185,103,255,0.08)]">

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-violet-300/40">Mix</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex h-5 w-5 items-center justify-center text-violet-300/30 hover:text-violet-300/50 transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      </div>

      {/* BPM */}
      <div className="flex items-center justify-between px-3.5 pb-2">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono text-fuchsia-400/65 tabular-nums">{bpmA ?? "—"}</span>
          {camelotA && <span className="text-[9px] font-mono text-amber-300/40">{camelotA}</span>}
        </div>
        <div className="flex items-center gap-1">
          {camelotB && <span className="text-[9px] font-mono text-amber-300/40">{camelotB}</span>}
          <span className="text-[11px] font-mono text-cyan-400/65 tabular-nums">{bpmB ?? "—"}</span>
        </div>
      </div>

      {/* Crossfader */}
      <div className="px-3.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-fuchsia-400/45">A</span>
          <Slider value={[crossfader * 100]} onValueChange={([v]) => onCrossfadeChange(v / 100)} max={100} step={1} className="flex-1" />
          <span className="text-[9px] font-mono text-cyan-400/45">B</span>
        </div>
      </div>

      {/* Transition */}
      <div className="px-3.5 pb-2">
        {transitionState.isActive ? (
          <button
            type="button"
            onClick={onCancelTransition}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[9px] font-mono uppercase tracking-widest text-red-400/70 hover:text-red-400 transition-all"
          >
            <span className="h-1 w-1 rounded-full bg-red-400 animate-pulse shadow-[0_0_6px_rgba(248,113,113,0.4)]" />
            {Math.round(transitionState.progress * 100)}%
          </button>
        ) : (
          <button
            type="button"
            onClick={onTransition}
            disabled={!trackALoaded || !trackBLoaded}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[9px] font-mono uppercase tracking-widest transition-all disabled:opacity-10",
              trackALoaded && trackBLoaded
                ? "text-fuchsia-400/50 hover:text-fuchsia-400/80 hover:bg-fuchsia-400/[0.06] hover:shadow-[0_0_16px_rgba(246,46,151,0.15)]"
                : "text-violet-300/20 hover:text-violet-300/35",
            )}
          >
            <Shuffle className="h-3 w-3" />
            Transition
          </button>
        )}
      </div>

      <div className="mx-3.5 h-px bg-violet-500/[0.06]" />

      {/* Tabs */}
      <div className="flex px-3.5 py-1.5">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-1.5 text-[9px] font-mono uppercase tracking-[0.12em] transition-all rounded",
              tab === id ? "text-violet-200/65 bg-violet-500/[0.12]" : "text-violet-300/30 hover:text-violet-300/45",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pb-3 space-y-2.5">
        {tab === "eq" && (
          <>
            <div className="grid grid-cols-3 gap-1">
              {(["high", "mid", "low"] as const).map((band) => {
                const v = musicObject.eq?.[band] ?? 0
                return (
                  <div key={band} className="flex flex-col items-center gap-1">
                    <Label>{band}</Label>
                    <div className="h-16 flex items-center">
                      <Slider orientation="vertical" value={[v + 12]} onValueChange={([n]) => onEQChange(band, n - 12)} max={24} step={0.5} className="h-full !min-h-0" />
                    </div>
                    <Val active={v !== 0} color={v > 0 ? "a" : v < 0 ? "b" : undefined}>{v > 0 ? "+" : ""}{v.toFixed(0)}</Val>
                  </div>
                )
              })}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label>Filter</Label>
                <Val active={(musicObject.filter?.cutoff ?? 20000) < 19000} color="a">{(musicObject.filter?.cutoff ?? 20000) >= 1000 ? `${((musicObject.filter?.cutoff ?? 20000) / 1000).toFixed(1)}k` : (musicObject.filter?.cutoff ?? 20000).toFixed(0)} Hz</Val>
              </div>
              <Slider value={[(Math.log10(musicObject.filter?.cutoff ?? 20000) / Math.log10(20000)) * 100]} onValueChange={([v]) => onFilterChange(Math.pow(10, (v / 100) * Math.log10(20000)))} max={100} step={1} />
            </div>
          </>
        )}

        {tab === "fx" && (
          <>
            {([
              { label: "Reverb", value: musicObject.reverbAmount ?? 0, onChange: onReverbChange, col: "b" as const },
              { label: "Delay", value: musicObject.delayAmount ?? 0, onChange: onDelayChange, col: "a" as const },
            ]).map(({ label, value, onChange, col }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label>{label}</Label>
                  <Val active={value > 0} color={value > 0 ? col : undefined}>{Math.round(value * 100)}%</Val>
                </div>
                <Slider value={[value * 100]} onValueChange={([v]) => onChange(v / 100)} max={100} step={1} />
              </div>
            ))}
            {onFXChange && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label>Flanger</Label>
                    <Val active={(musicObject.fx?.flangerMix ?? 0) > 0} color={(musicObject.fx?.flangerMix ?? 0) > 0 ? "a" : undefined}>{Math.round((musicObject.fx?.flangerMix ?? 0) * 100)}%</Val>
                  </div>
                  <Slider value={[(musicObject.fx?.flangerMix ?? 0) * 100]} onValueChange={([v]) => onFXChange("flangerMix", v / 100)} max={100} step={1} />
                </div>
                {(musicObject.fx?.flangerMix ?? 0) > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label>Rate</Label>
                      <Val>{(musicObject.fx?.flangerRate ?? 0.25).toFixed(2)} Hz</Val>
                    </div>
                    <Slider value={[(musicObject.fx?.flangerRate ?? 0.25) * 200]} onValueChange={([v]) => onFXChange("flangerRate", v / 200)} max={100} step={1} />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "iso" && (
          <>
            {(["bass", "voice", "melody"] as const).map((type) => (
              <div key={type} className="space-y-1">
                <Label>{type}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["A", "B"] as const).map((d) => (
                    <div key={d} className="space-y-0.5">
                      <span className={cn("text-[9px] font-mono", d === "A" ? "text-fuchsia-400/50" : "text-cyan-400/50")}>{d}</span>
                      <Slider
                        value={[((musicObject.tracks?.[d] as Record<string, number> | null)?.[`${type}Isolation`] ?? 0) * 100]}
                        onValueChange={([v]) => onIsolationChange(d, type, v / 100)}
                        max={100} step={1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "deck" && (
          <>
            {(["A", "B"] as const).map((d) => {
              const deckColor = d === "A" ? "a" as const : "b" as const
              return (
                <div key={d} className="space-y-1.5">
                  <span className={cn("text-[9px] font-mono font-bold", d === "A" ? "text-fuchsia-400/50" : "text-cyan-400/50")}>Deck {d}</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(["low", "mid", "high"] as const).map((band) => {
                      const v = musicObject.perDeckEq?.[d]?.[band] ?? 0
                      return (
                        <div key={band} className="flex flex-col items-center gap-0.5">
                          <Label color={deckColor}>{band}</Label>
                          <div className="h-14 flex items-center">
                            <Slider orientation="vertical" value={[v + 12]} onValueChange={([n]) => onPerDeckEQChange(d, band, n - 12)} max={24} step={0.5} className="h-full !min-h-0" />
                          </div>
                          <Val active={v !== 0} color={v !== 0 ? deckColor : undefined}>{v > 0 ? "+" : ""}{v.toFixed(0)}</Val>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Master */}
        <div className="space-y-1 pt-1.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <Volume2 className="h-2.5 w-2.5 text-violet-300/35" />
              <Label>Master</Label>
            </div>
            <Val active>{Math.round((musicObject.masterGain ?? 0.8) * 100)}%</Val>
          </div>
          <Slider value={[(musicObject.masterGain ?? 0.8) * 100]} onValueChange={([v]) => onMasterGainChange(v / 100)} max={100} step={1} />
        </div>
      </div>
    </aside>
  )
}
