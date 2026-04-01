"use client"

import type { MusicObject } from "@/lib/types"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface MixerProps {
  musicObject: MusicObject
  onCrossfadeChange: (value: number) => void
  onEQChange: (band: "low" | "mid" | "high", value: number) => void
  onFilterChange: (cutoff: number) => void
  onReverbChange: (value: number) => void
  onDelayChange: (value: number) => void
  onMasterGainChange: (value: number) => void
  onIsolationChange?: (deck: "A" | "B", type: "bass" | "voice" | "melody", value: number) => void
  onFXChange?: (param: string, value: number) => void
  onPerDeckEQChange?: (deck: "A" | "B", band: "low" | "mid" | "high", value: number) => void
  bpmA?: number | null
  bpmB?: number | null
  camelotA?: string | null
  camelotB?: string | null
  keyCompatibility?: number | null
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-white/30 uppercase tracking-[0.15em]">{children}</span>
}

function Value({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return <span className={cn("text-[11px] font-mono tabular-nums", highlight ? "text-white/70" : "text-white/30")}>{children}</span>
}

function CompatibilityBadge({ score }: { score: number }) {
  const color = score >= 0.85 ? "text-emerald-400 bg-emerald-500/10" :
                score >= 0.7 ? "text-yellow-400 bg-yellow-500/10" :
                score >= 0.5 ? "text-fuchsia-400 bg-fuchsia-500/10" :
                "text-red-400 bg-red-500/10"
  const label = score >= 0.85 ? "GREAT" :
                score >= 0.7 ? "GOOD" :
                score >= 0.5 ? "OK" : "CLASH"

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider", color)}>
      {label}
    </span>
  )
}

export function Mixer({
  musicObject, onCrossfadeChange, onEQChange, onFilterChange,
  onReverbChange, onDelayChange, onMasterGainChange, onIsolationChange,
  onFXChange, onPerDeckEQChange, bpmA, bpmB, camelotA, camelotB, keyCompatibility,
}: MixerProps) {
  const crossfader = musicObject.crossfader ?? 0.5

  return (
    <div className="rounded-xl bg-[#150535] border border-violet-500/[0.08] p-3 flex flex-col gap-3">

      {/* BPM + Key row */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-mono font-semibold text-fuchsia-400/80 tabular-nums">{bpmA ?? "—"}</span>
          {camelotA && (
            <span className="text-[9px] font-mono text-fuchsia-400/50 bg-fuchsia-500/10 px-1 rounded">{camelotA}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/20 uppercase tracking-widest">Mixer</span>
          {keyCompatibility !== null && keyCompatibility !== undefined && (
            <CompatibilityBadge score={keyCompatibility} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {camelotB && (
            <span className="text-[9px] font-mono text-cyan-400/50 bg-cyan-500/10 px-1 rounded">{camelotB}</span>
          )}
          <span className="text-[12px] font-mono font-semibold text-cyan-400/80 tabular-nums">{bpmB ?? "—"}</span>
        </div>
      </div>

      {/* Crossfader */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="px-2 py-0.5 rounded bg-fuchsia-500/10 text-[10px] font-bold text-fuchsia-400">A</span>
          <span className="text-[9px] text-white/20 uppercase tracking-widest">XFADE</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-[10px] font-bold text-cyan-400">B</span>
        </div>
        <Slider value={[crossfader * 100]} onValueChange={([v]) => onCrossfadeChange(v / 100)} max={100} step={1} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="eq" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-7 rounded-lg bg-black/40 border border-violet-500/[0.08] p-0.5">
          <TabsTrigger value="eq" className="text-[10px] uppercase tracking-wider data-[state=active]:bg-white/[0.08] data-[state=active]:text-white/80 data-[state=active]:rounded-md text-white/30">EQ</TabsTrigger>
          <TabsTrigger value="fx" className="text-[10px] uppercase tracking-wider data-[state=active]:bg-white/[0.08] data-[state=active]:text-white/80 data-[state=active]:rounded-md text-white/30">FX</TabsTrigger>
          <TabsTrigger value="iso" className="text-[10px] uppercase tracking-wider data-[state=active]:bg-white/[0.08] data-[state=active]:text-white/80 data-[state=active]:rounded-md text-white/30">ISO</TabsTrigger>
          <TabsTrigger value="deck" className="text-[10px] uppercase tracking-wider data-[state=active]:bg-white/[0.08] data-[state=active]:text-white/80 data-[state=active]:rounded-md text-white/30">A|B</TabsTrigger>
        </TabsList>

        {/* Master EQ */}
        <TabsContent value="eq" className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-1">
            {(["high", "mid", "low"] as const).map((band) => {
              const v = musicObject.eq?.[band] ?? 0
              return (
                <div key={band} className="flex flex-col items-center gap-2">
                  <Label>{band}</Label>
                  <div className="h-24 flex items-center">
                    <Slider orientation="vertical" value={[v + 12]} onValueChange={([n]) => onEQChange(band, n - 12)} max={24} step={0.5} className="h-full !min-h-0" />
                  </div>
                  <Value highlight={v !== 0}>{v > 0 ? "+" : ""}{v.toFixed(0)}</Value>
                </div>
              )
            })}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
            <div className="flex justify-between items-center">
              <Label>Filter</Label>
              <Value>
                {(musicObject.filter?.cutoff ?? 20000) >= 1000
                  ? `${((musicObject.filter?.cutoff ?? 20000) / 1000).toFixed(1)}k`
                  : (musicObject.filter?.cutoff ?? 20000).toFixed(0)} Hz
              </Value>
            </div>
            <Slider
              value={[(Math.log10(musicObject.filter?.cutoff ?? 20000) / Math.log10(20000)) * 100]}
              onValueChange={([v]) => onFilterChange(Math.pow(10, (v / 100) * Math.log10(20000)))}
              max={100} step={1}
            />
          </div>
        </TabsContent>

        {/* FX — now with Flanger */}
        <TabsContent value="fx" className="mt-3 space-y-3">
          {([
            { label: "Reverb", value: musicObject.reverbAmount ?? 0, onChange: onReverbChange },
            { label: "Delay", value: musicObject.delayAmount ?? 0, onChange: onDelayChange },
          ] as const).map(({ label, value, onChange }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label>{label}</Label>
                <Value>{Math.round(value * 100)}%</Value>
              </div>
              <Slider value={[value * 100]} onValueChange={([v]) => onChange(v / 100)} max={100} step={1} />
            </div>
          ))}

          {/* Flanger */}
          {onFXChange && (
            <>
              <div className="pt-2 border-t border-white/[0.04] space-y-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label>Flanger</Label>
                    <Value>{Math.round((musicObject.fx?.flangerMix ?? 0) * 100)}%</Value>
                  </div>
                  <Slider
                    value={[(musicObject.fx?.flangerMix ?? 0) * 100]}
                    onValueChange={([v]) => onFXChange("flangerMix", v / 100)}
                    max={100} step={1}
                  />
                </div>
                {(musicObject.fx?.flangerMix ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label>Rate</Label>
                      <Value>{(musicObject.fx?.flangerRate ?? 0.25).toFixed(2)} Hz</Value>
                    </div>
                    <Slider
                      value={[(musicObject.fx?.flangerRate ?? 0.25) * 200]}
                      onValueChange={([v]) => onFXChange("flangerRate", v / 200)}
                      max={100} step={1}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ISO */}
        <TabsContent value="iso" className="mt-3 space-y-3">
          {onIsolationChange ? (
            (["bass", "voice", "melody"] as const).map((type) => (
              <div key={type} className="space-y-1.5">
                <Label>{type}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["A", "B"] as const).map((d) => (
                    <div key={d} className="space-y-1">
                      <span className={cn("text-[9px] font-mono", d === "A" ? "text-fuchsia-400/60" : "text-cyan-400/60")}>{d}</span>
                      <Slider
                        value={[((musicObject.tracks?.[d] as Record<string, number> | null)?.[`${type}Isolation`] ?? 0) * 100]}
                        onValueChange={([v]) => onIsolationChange(d, type, v / 100)}
                        max={100} step={1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-white/20 text-center py-3">Not available</p>
          )}
        </TabsContent>

        {/* Per-Deck EQ — independent EQ per deck for bass-swap mixing */}
        <TabsContent value="deck" className="mt-3 space-y-3">
          {onPerDeckEQChange ? (
            (["A", "B"] as const).map((d) => (
              <div key={d} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold",
                    d === "A" ? "bg-fuchsia-500/15 text-fuchsia-400" : "bg-cyan-500/15 text-cyan-400"
                  )}>
                    Deck {d}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["low", "mid", "high"] as const).map((band) => {
                    const v = musicObject.perDeckEq?.[d]?.[band] ?? 0
                    return (
                      <div key={band} className="flex flex-col items-center gap-1">
                        <Label>{band}</Label>
                        <div className="h-20 flex items-center">
                          <Slider
                            orientation="vertical"
                            value={[v + 12]}
                            onValueChange={([n]) => onPerDeckEQChange(d, band, n - 12)}
                            max={24} step={0.5}
                            className="h-full !min-h-0"
                          />
                        </div>
                        <Value highlight={v !== 0}>{v > 0 ? "+" : ""}{v.toFixed(0)}</Value>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-white/20 text-center py-3">Not available</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Master */}
      <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
        <div className="flex justify-between items-center">
          <Label>Master</Label>
          <Value highlight>{Math.round((musicObject.masterGain ?? 0.8) * 100)}%</Value>
        </div>
        <Slider value={[(musicObject.masterGain ?? 0.8) * 100]} onValueChange={([v]) => onMasterGainChange(v / 100)} max={100} step={1} />
      </div>
    </div>
  )
}
