import type { ChallengeResult } from './types'

export const contentScriptAccessReview = {
  purpose:
    'Run on normal webpages so Bir Söz can show the learning overlay during browsing.',
  observes: [
    'content script readiness',
    'same-document navigation/activity happened',
    'user answer/skip action inside the Bir Söz overlay',
  ],
  doesNotReadOrSend: [
    'page URL',
    'page title',
    'page text or HTML',
    'form inputs',
    'passwords',
    'cookies',
    'clicked links',
    'CSS selectors',
    'screenshots',
    'browsing history',
  ],
} as const

export const contentReadyMessage = {
  type: 'bir-soz:content-ready',
} as const

export const pageActivityMessage = {
  type: 'bir-soz:page-activity',
} as const

export function challengeResultMessage(payload: ChallengeResult) {
  return {
    type: 'bir-soz:submit-result',
    payload,
  } as const
}
