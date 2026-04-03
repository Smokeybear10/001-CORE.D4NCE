// Per-song metadata for every sample track in the library.
// Timestamps from actual song structure analysis + music databases.
// Used by the transition builder to pick exact cue points and techniques.

import type { Track } from "./types"

export type SongSection = {
  type: "intro" | "verse" | "prechorus" | "chorus" | "drop" | "bridge" | "breakdown" | "outro"
  start: number   // seconds
  end: number     // seconds
  energy: number  // 0-1
  note?: string   // what's happening musically
}

export type TrackMeta = {
  bpm: number
  key: string
  camelot: string
  energy: number
  duration: number
  sections: SongSection[]
  mixIn: number     // best cue point for incoming (seconds)
  mixOut: number    // best point to start fading out (seconds)
  mixInAlt: number  // alternate mix-in (e.g., chorus hit for instant energy)
  mixOutAlt: number // alternate mix-out
}

// ─── Song Database ───────────────────────────────────────────────────────────

const SAMPLE_META: Record<string, TrackMeta> = {

  // 1. Lush Life — Zara Larsson (98 BPM, tropical house pop)
  "sample-1": {
    bpm: 98, key: "G minor", camelot: "6A", energy: 0.78, duration: 201,
    mixIn: 0, mixOut: 168, mixInAlt: 56, mixOutAlt: 196,
    sections: [
      { type: "intro",    start: 0,   end: 14,  energy: 0.3, note: "tropical synth riff, whistle hook, no vocals" },
      { type: "verse",    start: 14,  end: 56,  energy: 0.5, note: "rap-sing vocal, sparse beat, rubbery bass" },
      { type: "chorus",   start: 56,  end: 84,  energy: 0.85, note: "full production, triplet echo claps, whistle riff" },
      { type: "verse",    start: 84,  end: 126, energy: 0.5, note: "strips back to verse texture" },
      { type: "chorus",   start: 126, end: 168, energy: 0.85, note: "full chorus, G minor fully established" },
      { type: "bridge",   start: 168, end: 182, energy: 0.4, note: "stripped-back, synth melody prominent — ideal blend zone" },
      { type: "chorus",   start: 182, end: 196, energy: 0.85, note: "final chorus" },
      { type: "outro",    start: 196, end: 201, energy: 0.2, note: "quick fade on synth riff" },
    ],
  },

  // 2. Lean On — Major Lazer & DJ Snake ft. MØ (98 BPM, moombahton)
  "sample-2": {
    bpm: 98, key: "F minor", camelot: "4A", energy: 0.85, duration: 177,
    mixIn: 0, mixOut: 133, mixInAlt: 44, mixOutAlt: 164,
    sections: [
      { type: "intro",    start: 0,   end: 15,  energy: 0.4, note: "moombahton percussion, signature synth hook" },
      { type: "verse",    start: 15,  end: 44,  energy: 0.5, note: "MØ vocals, sparse production" },
      { type: "prechorus",start: 44,  end: 58,  energy: 0.7, note: "filter sweep build, vocals rise" },
      { type: "drop",     start: 58,  end: 74,  energy: 0.95, note: "full moombahton drop, instrumental, DJ Snake synth line" },
      { type: "verse",    start: 74,  end: 103, energy: 0.5, note: "pulls back, MØ vocals" },
      { type: "prechorus",start: 103, end: 117, energy: 0.7, note: "filter sweep build" },
      { type: "drop",     start: 117, end: 133, energy: 0.95, note: "full drop again" },
      { type: "breakdown",start: 133, end: 148, energy: 0.35, note: "vocal chops, light percussion — cleanest exit" },
      { type: "drop",     start: 148, end: 164, energy: 0.95, note: "biggest drop" },
      { type: "outro",    start: 164, end: 177, energy: 0.3, note: "synth hook fades, drums thin" },
    ],
  },

  // 3. Die Young — Kesha (128 BPM, electropop)
  // NOTE: chorus drops the drums (tribal stomps/claps only) — use as blend zone
  "sample-3": {
    bpm: 128, key: "C# minor", camelot: "12A", energy: 0.88, duration: 212,
    mixIn: 0, mixOut: 162, mixInAlt: 59, mixOutAlt: 204,
    sections: [
      { type: "intro",    start: 0,   end: 15,  energy: 0.4, note: "acoustic guitar, stomps & claps, tribal feel" },
      { type: "verse",    start: 15,  end: 44,  energy: 0.7, note: "half-rap vocal, electronic beat kicks in" },
      { type: "prechorus",start: 44,  end: 59,  energy: 0.8, note: "synth riffs build, new wave style" },
      { type: "chorus",   start: 59,  end: 88,  energy: 0.75, note: "DRUMS DROP OUT — gang vocal chants, stomps only. Blend zone!" },
      { type: "verse",    start: 88,  end: 118, energy: 0.7, note: "electronic beat returns" },
      { type: "prechorus",start: 118, end: 133, energy: 0.8, note: "same build" },
      { type: "chorus",   start: 133, end: 162, energy: 0.75, note: "drumless chorus again" },
      { type: "bridge",   start: 162, end: 180, energy: 0.4, note: "breakdown, synth pads build — ideal exit point" },
      { type: "chorus",   start: 180, end: 204, energy: 0.9, note: "final chorus with choir, glam rock drums" },
      { type: "outro",    start: 204, end: 212, energy: 0.2, note: "stomps fade" },
    ],
  },

  // 4. Starships — Nicki Minaj (125 BPM, pop-EDM)
  "sample-4": {
    bpm: 125, key: "D major", camelot: "10B", energy: 0.90, duration: 211,
    mixIn: 0, mixOut: 184, mixInAlt: 77, mixOutAlt: 206,
    sections: [
      { type: "intro",    start: 0,   end: 10,  energy: 0.5, note: "electric guitar riff, instantly recognizable" },
      { type: "verse",    start: 10,  end: 36,  energy: 0.6, note: "Nicki rapping over dance-pop beat" },
      { type: "prechorus",start: 36,  end: 51,  energy: 0.75, note: "shifts to singing, synth buildup" },
      { type: "chorus",   start: 51,  end: 77,  energy: 0.9, note: "full pop chorus, big hooks" },
      { type: "drop",     start: 77,  end: 98,  energy: 0.95, note: "EDM drop — bass, chanting, no vocals. Layer zone!" },
      { type: "verse",    start: 98,  end: 124, energy: 0.6, note: "rap verse 2" },
      { type: "prechorus",start: 124, end: 138, energy: 0.75, note: "same buildup" },
      { type: "chorus",   start: 138, end: 164, energy: 0.9, note: "full chorus" },
      { type: "drop",     start: 164, end: 184, energy: 0.95, note: "second EDM drop — can layer with incoming" },
      { type: "bridge",   start: 184, end: 194, energy: 0.5, note: "brief breakdown, stadium chanting" },
      { type: "chorus",   start: 194, end: 206, energy: 0.9, note: "final chorus with backing vocals" },
      { type: "outro",    start: 206, end: 211, energy: 0.2, note: "quick synth fade" },
    ],
  },

  // 5. FE!N — Travis Scott ft. Playboi Carti (148 BPM, rage trap)
  // WARNING: 148 BPM — won't blend with 125-128 tracks. Use echo out / hard cut.
  "sample-5": {
    bpm: 148, key: "Eb minor", camelot: "2A", energy: 0.82, duration: 191,
    mixIn: 0, mixOut: 128, mixInAlt: 18, mixOutAlt: 184,
    sections: [
      { type: "intro",    start: 0,   end: 18,  energy: 0.6, note: "alarm synth, dark atmosphere building" },
      { type: "chorus",   start: 18,  end: 42,  energy: 0.9, note: "Travis high-pitch 'fiend' chant, full rage beat" },
      { type: "verse",    start: 42,  end: 74,  energy: 0.8, note: "Carti deeper voice, Atlanta trap flow" },
      { type: "chorus",   start: 74,  end: 98,  energy: 0.9, note: "fiend chant returns" },
      { type: "verse",    start: 98,  end: 128, energy: 0.8, note: "Carti second verse" },
      { type: "breakdown",start: 128, end: 144, energy: 0.5, note: "brief dip, Carti ad-libs — only real exit window" },
      { type: "verse",    start: 144, end: 170, energy: 0.8, note: "Travis verse" },
      { type: "chorus",   start: 170, end: 184, energy: 0.9, note: "final fiend chant" },
      { type: "outro",    start: 184, end: 191, energy: 0.3, note: "beat rides out" },
    ],
  },

  // 6. TiK ToK — Kesha (120 BPM, electropop)
  "sample-6": {
    bpm: 120, key: "D minor", camelot: "7A", energy: 0.80, duration: 199,
    mixIn: 0, mixOut: 168, mixInAlt: 62, mixOutAlt: 194,
    sections: [
      { type: "intro",    start: 0,   end: 14,  energy: 0.4, note: "iconic spoken intro with Auto-Tune, P. Diddy cameo" },
      { type: "verse",    start: 14,  end: 50,  energy: 0.6, note: "rap-sing, bitpop drums, stabbing synth hook" },
      { type: "verse",    start: 50,  end: 62,  energy: 0.65, note: "'tipsy' vocal slowdown break — blend-friendly moment" },
      { type: "chorus",   start: 62,  end: 100, energy: 0.9, note: "blaring synths, hammering production, full Auto-Tune" },
      { type: "verse",    start: 100, end: 132, energy: 0.6, note: "back to rap-sing" },
      { type: "chorus",   start: 132, end: 168, energy: 0.9, note: "extended chorus" },
      { type: "bridge",   start: 168, end: 186, energy: 0.45, note: "breakdown, texture change — ideal exit point" },
      { type: "chorus",   start: 186, end: 194, energy: 0.9, note: "final chorus blast" },
      { type: "outro",    start: 194, end: 199, energy: 0.2, note: "quick fade" },
    ],
  },

  // 7. Gasolina — Daddy Yankee (96 BPM, reggaeton)
  "sample-7": {
    bpm: 96, key: "B minor", camelot: "10A", energy: 0.88, duration: 192,
    mixIn: 0, mixOut: 116, mixInAlt: 48, mixOutAlt: 180,
    sections: [
      { type: "intro",    start: 0,   end: 20,  energy: 0.6, note: "synth, engine revving, shouts, dembow drops in" },
      { type: "verse",    start: 20,  end: 48,  energy: 0.7, note: "rapid-fire staccato rap, full dembow groove" },
      { type: "chorus",   start: 48,  end: 68,  energy: 0.95, note: "call-and-response 'dame mas gasolina', explosive" },
      { type: "verse",    start: 68,  end: 96,  energy: 0.7, note: "second rap verse" },
      { type: "chorus",   start: 96,  end: 116, energy: 0.95, note: "chorus with engine revving" },
      { type: "breakdown",start: 116, end: 136, energy: 0.4, note: "thins out, 'prenda lo motore' chant — best exit" },
      { type: "verse",    start: 136, end: 160, energy: 0.75, note: "final verse building back" },
      { type: "chorus",   start: 160, end: 180, energy: 0.95, note: "final chorus, peak crowd energy" },
      { type: "outro",    start: 180, end: 192, energy: 0.3, note: "dembow fades, shouts" },
    ],
  },

  // 8. Like A G6 — Far East Movement (128 BPM, electro-hop)
  "sample-8": {
    bpm: 128, key: "G minor", camelot: "6A", energy: 0.85, duration: 218,
    mixIn: 0, mixOut: 130, mixInAlt: 154, mixOutAlt: 194,
    sections: [
      { type: "intro",    start: 0,   end: 15,  energy: 0.4, note: "signature synth-bloop riff, filtered, building" },
      { type: "chorus",   start: 15,  end: 38,  energy: 0.85, note: "DEV Auto-Tuned hook, hypnotic chanting, heavy bass" },
      { type: "verse",    start: 38,  end: 60,  energy: 0.7, note: "FM rap verse, goofy delivery" },
      { type: "chorus",   start: 60,  end: 84,  energy: 0.85, note: "hook returns" },
      { type: "verse",    start: 84,  end: 108, energy: 0.7, note: "second rap verse" },
      { type: "chorus",   start: 108, end: 130, energy: 0.85, note: "hook repeats, building" },
      { type: "breakdown",start: 130, end: 154, energy: 0.4, note: "drums thin, synth riff continues — best exit point" },
      { type: "drop",     start: 154, end: 178, energy: 0.95, note: "biggest drop, full bass, peak energy" },
      { type: "verse",    start: 178, end: 194, energy: 0.7, note: "final verse" },
      { type: "outro",    start: 194, end: 218, energy: 0.3, note: "final hooks fading" },
    ],
  },

  // 9. Fire! — Alan Walker ft. JVKE & YUQI (125 BPM, piano house)
  // WARNING: only 2:03 — very short, plan transitions carefully
  "sample-9": {
    bpm: 125, key: "Db major", camelot: "5B", energy: 0.83, duration: 123,
    mixIn: 0, mixOut: 60, mixInAlt: 42, mixOutAlt: 108,
    sections: [
      { type: "intro",    start: 0,   end: 12,  energy: 0.3, note: "piano chords (Fm-Db-Eb-Cm), light percussion" },
      { type: "verse",    start: 12,  end: 30,  energy: 0.5, note: "JVKE vocals, stripped piano house beat" },
      { type: "prechorus",start: 30,  end: 42,  energy: 0.7, note: "synth layers build, snare roll riser" },
      { type: "drop",     start: 42,  end: 60,  energy: 0.95, note: "piano house drop — full bass, kicks, piano riff" },
      { type: "verse",    start: 60,  end: 76,  energy: 0.5, note: "YUQI vocals, production pulls back — exit window" },
      { type: "prechorus",start: 76,  end: 88,  energy: 0.7, note: "buildup again" },
      { type: "drop",     start: 88,  end: 108, energy: 0.95, note: "second drop, peak energy" },
      { type: "outro",    start: 108, end: 123, energy: 0.2, note: "piano echoes, quick fade" },
    ],
  },

  // 10. Last Friday Night (T.G.I.F.) — Katy Perry (126 BPM, dance-pop)
  "sample-10": {
    bpm: 126, key: "F# major", camelot: "2B", energy: 0.82, duration: 230,
    mixIn: 0, mixOut: 176, mixInAlt: 56, mixOutAlt: 222,
    sections: [
      { type: "intro",    start: 0,   end: 14,  energy: 0.5, note: "synth/keyboard riff, bright party energy" },
      { type: "verse",    start: 14,  end: 42,  energy: 0.6, note: "Katy conversational vocals, mid-energy groove" },
      { type: "prechorus",start: 42,  end: 56,  energy: 0.75, note: "vocals rise, synth layers build" },
      { type: "chorus",   start: 56,  end: 82,  energy: 0.9, note: "full chorus, big pop hooks, maximum catchiness" },
      { type: "verse",    start: 82,  end: 110, energy: 0.6, note: "second verse, energy dips" },
      { type: "prechorus",start: 110, end: 124, energy: 0.75, note: "building again" },
      { type: "chorus",   start: 124, end: 176, energy: 0.9, note: "extended chorus + TGIF chant" },
      { type: "bridge",   start: 176, end: 198, energy: 0.6, note: "saxophone solo! Different texture — smoothest exit" },
      { type: "chorus",   start: 198, end: 222, energy: 0.9, note: "final chorus, all elements stacked" },
      { type: "outro",    start: 222, end: 230, energy: 0.2, note: "quick fade" },
    ],
  },
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getTrackMeta(track: Track): TrackMeta | null {
  return SAMPLE_META[track.id] ?? null
}

export function getTrackBpm(track: Track): number {
  if (track.bpm) return track.bpm
  return SAMPLE_META[track.id]?.bpm ?? 128
}

export function getTrackKey(track: Track): string {
  if (track.key) return track.key
  return SAMPLE_META[track.id]?.key ?? "C major"
}

export function getTrackEnergy(track: Track): number {
  if (track.energy !== undefined) return track.energy
  return SAMPLE_META[track.id]?.energy ?? 0.8
}

/** Get the best mix-in cue point for this track (seconds).
 *  Returns the song-specific point if known, 0 otherwise. */
export function getHardcodedMixIn(track: Track): number {
  return SAMPLE_META[track.id]?.mixIn ?? 0
}

/** Get the best mix-out point for this track (seconds).
 *  Returns the song-specific point if known, or 80% of duration. */
export function getHardcodedMixOut(track: Track, duration: number): number {
  return SAMPLE_META[track.id]?.mixOut ?? (duration * 0.8)
}

/** Find the current section of a track at a given time */
export function getCurrentSection(track: Track, time: number): SongSection | null {
  const meta = SAMPLE_META[track.id]
  if (!meta) return null
  return meta.sections.find(s => time >= s.start && time < s.end) ?? null
}

/** Find the next low-energy section (breakdown/bridge/outro) after currentTime */
export function getNextBlendZone(track: Track, currentTime: number): SongSection | null {
  const meta = SAMPLE_META[track.id]
  if (!meta) return null
  return meta.sections.find(
    s => s.start > currentTime && s.energy < 0.5
      && (s.type === "bridge" || s.type === "breakdown" || s.type === "outro")
  ) ?? null
}
