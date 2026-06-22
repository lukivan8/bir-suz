import type { SrsData, WordItem } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const FAST_ANSWER_MS = 2500
const SLOW_ANSWER_MS = 7000

export function calculateNextSrs(
  current: SrsData,
  quality: number,
  now = Date.now(),
): SrsData {
  const clampedQuality = Math.min(5, Math.max(0, Math.round(quality)))
  const easeFactor = Math.max(
    1.3,
    current.easeFactor +
      (0.1 - (5 - clampedQuality) * (0.08 + (5 - clampedQuality) * 0.02)),
  )

  if (clampedQuality < 3) {
    return {
      repetition: 0,
      interval: 1,
      easeFactor,
      nextReview: now + DAY_MS,
      lastReviewedAt: now,
    }
  }

  const repetition = current.repetition + 1
  let interval: number

  if (repetition === 1) interval = 1
  else if (repetition === 2) interval = 6
  else interval = Math.max(1, Math.round(current.interval * easeFactor))

  return {
    repetition,
    interval,
    easeFactor,
    nextReview: now + interval * DAY_MS,
    lastReviewedAt: now,
  }
}

export function qualityFromResult(options: {
  wasCorrect: boolean
  wasSkipped: boolean
  timedOut: boolean
  elapsedMs: number
}) {
  if (options.wasSkipped || options.timedOut) return 0
  if (!options.wasCorrect) return 2
  if (options.elapsedMs <= FAST_ANSWER_MS) return 5
  if (options.elapsedMs >= SLOW_ANSWER_MS) return 3
  return 4
}

export function isDue(nextReview: number, now = Date.now()) {
  return nextReview <= now
}

export function isMastered(word: WordItem) {
  return word.srs.repetition >= 3 && word.srs.interval > 7
}

/**
 * SM-2 examples with default ease 2.5:
 * - quality 5 first success: repetition 1, interval 1 day, ease 2.6.
 * - quality 4 second success: repetition 2, interval 6 days, ease stays near 2.6.
 * - quality 5 third success: interval becomes roughly previous interval * ease.
 * - quality 0/1/2 failure or skip: repetition resets to 0, next review is tomorrow.
 */
