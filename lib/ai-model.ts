// Centralized AI model configuration
// Swap the default or pass ?model= query param to override per-request

import { anthropic } from "@ai-sdk/anthropic"
import { xai } from "@ai-sdk/xai"

export type AIModelId = "sonnet" | "haiku" | "grok"

const models = {
  sonnet: () => anthropic("claude-sonnet-4-6"),
  haiku: () => anthropic("claude-haiku-4-5-20251001"),
  grok: () => xai("grok-3"),
} as const

const DEFAULT_MODEL: AIModelId = "grok"

export function getAIModel(override?: string | null) {
  const id = (override && override in models ? override : DEFAULT_MODEL) as AIModelId
  return models[id]()
}

// For the voice/chat route, which wants the lowest latency available
export function getFastModel(override?: string | null) {
  if (override === "sonnet") return anthropic("claude-sonnet-4-6")
  if (override === "haiku") return anthropic("claude-haiku-4-5-20251001")
  return xai("grok-3-fast")
}
