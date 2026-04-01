"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import type { Track } from "@/lib/types"
import { useTracks } from "@/hooks/use-tracks"
import { Upload, Search, Loader2, Sparkles, Trash2, Music } from "lucide-react"

interface MusicLibraryProps {
  onLoadToDeck: (track: Track, deck: "A" | "B") => void
  trackA?: Track | null
  trackB?: Track | null
}

export function MusicLibrary({ onLoadToDeck, trackA, trackB }: MusicLibraryProps) {
  const { tracks, isLoading, uploadTrack, deleteTrack, analyzeTrack } = useTracks()
  const [search, setSearch] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = tracks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.artist.toLowerCase().includes(search.toLowerCase()) ||
    t.genre?.toLowerCase().includes(search.toLowerCase())
  )

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`"${file.name}" exceeds 50MB`)
        await uploadTrack(file)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleAnalyze = async (track: Track) => {
    setAnalyzingId(track.id)
    try {
      await analyzeTrack(track)
    } catch {
      setFailedIds((prev) => new Set(prev).add(track.id))
    } finally {
      setAnalyzingId(null)
    }
  }

  useEffect(() => {
    const next = tracks.find((t) => !t.analyzed && !analyzingId && !failedIds.has(t.id))
    if (next) handleAnalyze(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, analyzingId, failedIds])

  return (
    <div className="overflow-hidden flex flex-col h-full">
      {/* Search + upload */}
      <div className="px-3 pt-2 pb-2 space-y-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-violet-300/10" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full h-7 pl-7 pr-3 text-[11px] bg-transparent border-b border-violet-500/[0.08] text-amber-200/50 placeholder:text-violet-300/10 focus:outline-none focus:border-white/15 transition-colors"
          />
        </div>
        <input ref={fileInputRef} type="file" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,audio/*" multiple className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-7 flex items-center justify-center gap-1.5 text-[10px] font-mono text-violet-300/15 hover:text-violet-300/30 transition-all disabled:opacity-30"
        >
          {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {uploadError && <p className="text-[9px] text-red-400/50">{uploadError}</p>}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="px-2 pb-2 space-y-0.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-violet-300/10" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-1.5">
              <Music className="h-5 w-5 text-violet-300/5" />
              <p className="text-[10px] text-violet-300/10">{search ? "No results" : "No tracks"}</p>
            </div>
          ) : (
            filtered.map((track) => {
              const onA = trackA?.id === track.id
              const onB = trackB?.id === track.id
              return (
                <div key={track.id} className="group relative px-2.5 py-2 rounded transition-colors cursor-default hover:bg-violet-500/[0.05]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-[11px] truncate leading-tight ${onA || onB ? "text-amber-200/60" : "text-violet-100/40"}`}>{track.title}</p>
                        {onA && <span className="shrink-0 text-[8px] font-mono text-amber-400/50">A</span>}
                        {onB && <span className="shrink-0 text-[8px] font-mono text-cyan-400/50">B</span>}
                      </div>
                      <p className="text-[9px] font-mono text-amber-300/15 mt-0.5 truncate">
                        {track.bpm ? `${Math.round(track.bpm)}` : ""}
                        {track.bpm && track.key ? " · " : ""}
                        {track.key ?? ""}
                        {!track.bpm && !track.key ? (
                          analyzingId === track.id ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-2 w-2 animate-spin inline" />
                            </span>
                          ) : "—"
                        ) : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => onLoadToDeck(track, "A")}
                        className="px-2 py-0.5 text-[10px] font-mono text-amber-400/40 hover:text-amber-400/80 transition-all"
                      >A</button>
                      <button
                        onClick={() => onLoadToDeck(track, "B")}
                        className="px-2 py-0.5 text-[10px] font-mono text-cyan-400/40 hover:text-cyan-400/80 transition-all"
                      >B</button>
                      <button
                        onClick={() => handleAnalyze(track)}
                        disabled={analyzingId === track.id}
                        className="w-5 h-5 flex items-center justify-center text-violet-300/10 hover:text-violet-300/30 transition-all disabled:opacity-30"
                      >
                        {analyzingId === track.id ? <Loader2 className="h-2 w-2 animate-spin" /> : <Sparkles className="h-2 w-2" />}
                      </button>
                      <button
                        onClick={() => deleteTrack(track.id, track.url)}
                        className="w-5 h-5 flex items-center justify-center text-violet-300/10 hover:text-violet-300/20 transition-all"
                      >
                        <Trash2 className="h-2 w-2" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
