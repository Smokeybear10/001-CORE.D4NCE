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
    <div className="rounded-xl bg-[#0c0c1a] border border-white/[0.06] overflow-hidden flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Library</span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-white/30">
            {tracks.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full h-8 pl-8 pr-3 text-[12px] bg-black/30 border border-white/[0.08] rounded-lg text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/[0.18] transition-colors"
          />
        </div>
      </div>

      {/* Upload */}
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <input ref={fileInputRef} type="file" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,audio/*" multiple className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-8 flex items-center justify-center gap-2 text-[11px] bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-lg text-white/40 hover:text-white/70 transition-all disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? "Uploading..." : "Upload Tracks"}
        </button>
        {uploadError && <p className="mt-2 text-[10px] text-red-400/70">{uploadError}</p>}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="p-2 space-y-0.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Music className="h-6 w-6 text-white/10" />
              <p className="text-[11px] text-white/20">{search ? "No results" : "No tracks yet"}</p>
            </div>
          ) : (
            filtered.map((track) => {
              const onA = trackA?.id === track.id
              const onB = trackB?.id === track.id
              return (
              <div key={track.id} className={`group relative px-3 py-2.5 rounded-lg transition-colors cursor-default ${
                onA ? "bg-violet-500/[0.07] hover:bg-violet-500/[0.10]" :
                onB ? "bg-cyan-500/[0.07] hover:bg-cyan-500/[0.10]" :
                "hover:bg-white/[0.04]"
              }`}>
                {/* Left accent bar */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full transition-opacity ${
                  onA ? "bg-violet-400 opacity-100" :
                  onB ? "bg-cyan-400 opacity-100" :
                  "bg-white/20 opacity-30 lg:opacity-0 lg:group-hover:opacity-100"
                }`} />
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[12px] font-medium truncate leading-tight ${onA || onB ? "text-white/90" : "text-white/75"}`}>{track.title}</p>
                      {onA && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">A</span>}
                      {onB && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">B</span>}
                    </div>
                    <p className="text-[10px] font-mono text-white/25 mt-0.5 truncate">
                      {track.bpm ? `${Math.round(track.bpm)} BPM` : ""}
                      {track.bpm && track.key ? " · " : ""}
                      {track.key ?? ""}
                      {!track.bpm && !track.key ? (
                        analyzingId === track.id ? (
                          <span className="flex items-center gap-1 inline-flex">
                            <Loader2 className="h-2 w-2 animate-spin inline" />
                            <span className="text-white/20">Analyzing...</span>
                          </span>
                        ) : "—"
                      ) : ""}
                    </p>
                  </div>

                  {/* Actions — always visible on touch / small screens; hover on lg+ */}
                  <div className="flex items-center gap-1 opacity-100 transition-opacity shrink-0 lg:opacity-0 lg:group-hover:opacity-100">
                    <button
                      onClick={() => onLoadToDeck(track, "A")}
                      className="rounded-md px-2.5 py-1 text-[11px] font-bold bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 transition-all flex items-center justify-center"
                      title="Load to Deck A"
                    >A</button>
                    <button
                      onClick={() => onLoadToDeck(track, "B")}
                      className="rounded-md px-2.5 py-1 text-[11px] font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 transition-all flex items-center justify-center"
                      title="Load to Deck B"
                    >B</button>
                    <button
                      onClick={() => handleAnalyze(track)}
                      disabled={analyzingId === track.id}
                      className="w-6 h-6 rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all flex items-center justify-center disabled:opacity-30"
                      title="Analyze"
                    >
                      {analyzingId === track.id
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        : <Sparkles className="h-2.5 w-2.5" />
                      }
                    </button>
                    <button
                      onClick={() => deleteTrack(track.id, track.url)}
                      className="w-6 h-6 rounded-md text-white/20 hover:text-red-400/70 hover:bg-red-400/10 transition-all flex items-center justify-center"
                      title="Delete"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
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
