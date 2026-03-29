"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface VoiceCommandState {
  isListening: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  isSupported: boolean
}

interface UseVoiceCommandsOptions {
  onCommand: (command: string) => void
  continuous?: boolean
  language?: string
}

export function useVoiceCommands({ onCommand, continuous = false, language = "en-US" }: UseVoiceCommandsOptions) {
  const [state, setState] = useState<VoiceCommandState>({
    isListening: false,
    transcript: "",
    interimTranscript: "",
    error: null,
    isSupported: false, // Initialize as false to avoid hydration mismatch
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onCommandRef = useRef(onCommand)

  // Check for speech recognition support on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window
      setState((prev) => ({ ...prev, isSupported: supported }))
    }
  }, [])

  // Keep onCommandRef up to date
  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = language

    recognition.onstart = () => {
      setState((prev) => ({ ...prev, isListening: true, error: null }))
    }

    recognition.onend = () => {
      setState((prev) => ({ ...prev, isListening: false, interimTranscript: "" }))
    }

    recognition.onerror = (event) => {
      // Ignore "aborted" and "no-speech" errors - they're normal
      if (event.error === "aborted" || event.error === "no-speech") {
        setState((prev) => ({ ...prev, isListening: false }))
        return
      }
      
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: event.error === "not-allowed" ? "Microphone access denied" : `Speech recognition error: ${event.error}`,
      }))
    }

    recognition.onresult = (event) => {
      let interim = ""
      let final = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      setState((prev) => ({
        ...prev,
        interimTranscript: interim,
        transcript: final || prev.transcript,
      }))

      if (final) {
        onCommandRef.current(final.trim())
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognition) {
        recognition.abort()
      }
    }
  }, [continuous, language])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setState((prev) => ({ ...prev, error: "Speech recognition not supported" }))
      return
    }

    setState((prev) => ({ ...prev, transcript: "", interimTranscript: "", error: null }))

    try {
      recognitionRef.current.start()
    } catch (e) {
      // Already started
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [state.isListening, startListening, stopListening])

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
  }
}

// Add types for SpeechRecognition (not in all TS DOM lib versions)
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    onstart: (() => void) | null
    onend: (() => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    start(): void
    stop(): void
    abort(): void
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number
    results: SpeechRecognitionResultList
  }
}
