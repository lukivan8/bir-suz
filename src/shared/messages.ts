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
  if (!isRecord(message) || typeof message['type'] !== 'string') return false

  switch (message['type']) {
    case 'bir-soz:content-ready':
    case 'bir-soz:navigation-click':
    case 'bir-soz:get-state':
    case 'bir-soz:force-trigger':
      return true
    case 'bir-soz:show-challenge':
      return isRecord(message['payload'])
    case 'bir-soz:submit-result':
      return isChallengeResult(message['payload'])
    default:
      return false
  }
}

function isChallengeResult(value: unknown): value is ChallengeResult {
  return (
    isRecord(value) &&
    typeof value['wordId'] === 'string' &&
    typeof value['source'] === 'string' &&
    typeof value['elapsedMs'] === 'number' &&
    typeof value['wasSkipped'] === 'boolean' &&
    typeof value['wasCorrect'] === 'boolean' &&
    typeof value['timedOut'] === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
