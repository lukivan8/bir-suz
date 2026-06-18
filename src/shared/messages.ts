import type { StatsEventType } from './stats'
import type { ChallengePayload, ChallengeResult, StorageShape } from './types'
import { isChallengePayload, isChallengeResult, isRecord } from './validation'

export type RuntimeMessage =
  | { type: 'bir-soz:content-ready' }
  | { type: 'bir-soz:page-activity' }
  | { type: 'bir-soz:get-state' }
  | { type: 'bir-soz:show-challenge'; payload: ChallengePayload }
  | { type: 'bir-soz:submit-result'; payload: ChallengeResult }
  | { type: 'bir-soz:force-trigger' }
  | {
      type: 'bir-soz:stats-event'
      eventType: Extract<StatsEventType, 'disabled' | 'enabled'>
    }

export type RuntimeResponse =
  | StorageShape
  | { ok: true }
  | { ok: false }
  | { triggered: boolean }

export type RuntimeResponseFor<TMessage extends RuntimeMessage> =
  TMessage extends { type: 'bir-soz:get-state' }
    ? StorageShape
    : TMessage extends {
          type: 'bir-soz:page-activity' | 'bir-soz:force-trigger'
        }
      ? { triggered: boolean }
      : { ok: boolean }

export function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  if (!isMessageLike(message) || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'bir-soz:content-ready':
    case 'bir-soz:page-activity':
    case 'bir-soz:get-state':
    case 'bir-soz:force-trigger':
      return true
    case 'bir-soz:stats-event':
      return message.eventType === 'disabled' || message.eventType === 'enabled'
    case 'bir-soz:show-challenge':
      return isChallengePayload(message.payload)
    case 'bir-soz:submit-result':
      return isChallengeResult(message.payload)
    default:
      return false
  }
}

function isMessageLike(value: unknown): value is {
  type?: unknown
  payload?: unknown
  eventType?: unknown
} {
  return isRecord(value)
}
