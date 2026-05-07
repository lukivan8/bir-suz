import type { ChallengePayload, ChallengeResult } from './types'

export type RuntimeMessage =
  | { type: 'bir-soz:content-ready' }
  | { type: 'bir-soz:navigation-click' }
  | { type: 'bir-soz:get-state' }
  | { type: 'bir-soz:show-challenge'; payload: ChallengePayload }
  | { type: 'bir-soz:submit-result'; payload: ChallengeResult }
  | { type: 'bir-soz:force-trigger' }

export type RuntimeResponse =
  | { ok: true }
  | { ok: false }
  | { triggered: boolean }

export function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  if (!isMessageLike(message) || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'bir-soz:content-ready':
    case 'bir-soz:navigation-click':
    case 'bir-soz:get-state':
    case 'bir-soz:force-trigger':
      return true
    case 'bir-soz:show-challenge':
      return isRecord(message.payload)
    case 'bir-soz:submit-result':
      return isChallengeResult(message.payload)
    default:
      return false
  }
}

function isChallengeResult(value: unknown): value is ChallengeResult {
  return (
    isChallengeResultLike(value) &&
    typeof value.wordId === 'string' &&
    typeof value.source === 'string' &&
    typeof value.elapsedMs === 'number' &&
    typeof value.wasSkipped === 'boolean' &&
    typeof value.wasCorrect === 'boolean' &&
    typeof value.timedOut === 'boolean'
  )
}

function isMessageLike(value: unknown): value is {
  type?: unknown
  payload?: unknown
} {
  return isRecord(value)
}

function isChallengeResultLike(value: unknown): value is {
  wordId?: unknown
  source?: unknown
  elapsedMs?: unknown
  wasSkipped?: unknown
  wasCorrect?: unknown
  timedOut?: unknown
} {
  return isRecord(value)
}

function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
