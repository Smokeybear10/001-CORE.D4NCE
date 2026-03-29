// In-memory store for tracks — uses globalThis to survive Next.js dev module reloads
import type { Track, Preset, DJCoachMessage } from "./types"

interface MusicStore {
  tracks: Track[]
  presets: Preset[]
  coachMessages: DJCoachMessage[]
}

const globalRef = globalThis as typeof globalThis & { __musicStore?: MusicStore }

// Force reset on code change — version bump this comment to clear stale cache: v3
if (!globalRef.__musicStore || !globalRef.__musicStore.tracks.find((t) => t.id === "sample-10")) {
  globalRef.__musicStore = {
    tracks: [
      {
        id: "sample-1",
        title: "Lush Life",
        artist: "Zara Larsson",
        url: "/uploads/1773721274538_Zara_Larsson_-_Lush_Life__Official_Video_.mp3",
        createdAt: new Date(),
        analyzed: true,
        genre: "Pop",
        mood: "Euphoric",
        energy: 0.78,
        bpm: 125,
        key: "F major",
        description: "Uplifting pop anthem with tropical house influences and soaring vocals",
        tags: ["pop", "tropical house", "uplifting", "summer", "dance"],
      },
      {
        id: "sample-2",
        title: "Lean On",
        artist: "Major Lazer & DJ Snake",
        url: "/uploads/1773721154711_Major_Lazer_DJ_Snake_-_Lean_On__feat._M___Official_4K_Music_Video.mp3",
        createdAt: new Date(),
        analyzed: true,
        genre: "Electronic",
        mood: "Energetic",
        energy: 0.85,
        bpm: 98,
        key: "G minor",
        description: "Global EDM crossover with dancehall rhythms and hypnotic drops",
        tags: ["edm", "dancehall", "trap", "electronic", "dance"],
      },
      {
        id: "sample-3",
        title: "Die Young",
        artist: "Kesha",
        url: "/uploads/1773785647892_Kesha_-_Die_Young__Lyrics_.mp3",
        createdAt: new Date(),
        analyzed: true,
        genre: "Pop",
        mood: "Party",
        energy: 0.88,
        bpm: 128,
        key: "G minor",
        description: "High-energy electropop party anthem with pulsing synths and euphoric drops",
        tags: ["pop", "electropop", "dance", "party", "edm"],
      },
      {
        id: "sample-4",
        title: "Starships",
        artist: "Nicki Minaj",
        url: "/uploads/1773785798416_Starships_-_Nicki_Minaj__Lyrics_.mp3",
        createdAt: new Date(),
        analyzed: true,
        genre: "Pop",
        mood: "Euphoric",
        energy: 0.90,
        bpm: 125,
        key: "F minor",
        description: "Explosive pop-EDM anthem with soaring synths, rap verses, and a massive chorus drop",
        tags: ["pop", "edm", "dance", "party", "anthem"],
      },
      {
        id: "sample-5",
        title: "FE!N",
        artist: "Travis Scott",
        url: "/uploads/1773788790314_Travis_Scott_-_FE_N__Lyrics_.mp3",
        createdAt: new Date(),
        analyzed: false,
      },
      {
        id: "sample-6",
        title: "TiK ToK",
        artist: "Kesha",
        url: "/uploads/1773788819758_Kesha_-_TiK_ToK__Lyrics_.mp3",
        createdAt: new Date(),
        analyzed: false,
      },
      {
        id: "sample-7",
        title: "Gasolina",
        artist: "Daddy Yankee",
        url: "/uploads/1773804229372_Gasolina_-_Daddy_Yankee__Lyrics_.mp3",
        createdAt: new Date(),
        analyzed: false,
      },
      {
        id: "sample-8",
        title: "Like A G6",
        artist: "Far East Movement ft. The Cataracs & DEV",
        url: "/uploads/1773804236999_Far_East_Movement_-_Like_A_G6_ft._The_Cataracs__DEV.mp3",
        createdAt: new Date(),
        analyzed: false,
      },
      {
        id: "sample-9",
        title: "Fire!",
        artist: "Alan Walker ft. JVKE & YUQI",
        url: "/uploads/1773804185954_Alan_Walker_-_Fire___Lyrics__ft._JVKE___YUQI.mp3",
        createdAt: new Date(),
        analyzed: false,
      },
      {
        id: "sample-10",
        title: "Last Friday Night",
        artist: "Katy Perry",
        url: "/uploads/1773804155728_Katy_Perry_-_Last_Friday_Night__Lyrics_.mp3",
        createdAt: new Date(),
        analyzed: false,
      },
    ],
    presets: [],
    coachMessages: [],
  }
}

const store = globalRef.__musicStore

export function getTracks(): Track[] {
  return store.tracks
}

export function addTrack(track: Track): void {
  store.tracks.push(track)
}

export function updateTrack(id: string, updates: Partial<Track>): void {
  const index = store.tracks.findIndex((t) => t.id === id)
  if (index !== -1) {
    store.tracks[index] = { ...store.tracks[index], ...updates }
  }
}

export function deleteTrack(id: string): void {
  store.tracks = store.tracks.filter((t) => t.id !== id)
}

export function getTrackById(id: string): Track | undefined {
  return store.tracks.find((t) => t.id === id)
}

export function setTracks(tracks: Track[]): void {
  store.tracks = tracks
}

export function getPresets(): Preset[] {
  return store.presets
}

export function addPreset(preset: Preset): void {
  store.presets.push(preset)
}

export function addCoachMessage(message: DJCoachMessage): void {
  store.coachMessages.push(message)
  // Keep only last 50 messages
  if (store.coachMessages.length > 50) {
    store.coachMessages = store.coachMessages.slice(-50)
  }
}

export function getCoachMessages(): DJCoachMessage[] {
  return store.coachMessages
}
