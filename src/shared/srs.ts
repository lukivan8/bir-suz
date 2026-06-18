import type { SrsData } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export function calculateNextSrs(
  current: SrsData,
  success: boolean,
  now = Date.now(),
): SrsData {
  if (!success) {
    return {
      repetition: 0,
      interval: 1,
      easeFactor: Math.max(1.3, current.easeFactor - 0.2),
      nextReview: now + DAY_MS,
      lastReviewedAt: now,
    }
  }

  const repetition = current.repetition + 1
  const easeFactor = Math.max(1.3, current.easeFactor + 0.1)

  let interval: number
  if (repetition === 1) interval = 1
  else if (repetition === 2) interval = 3
  else interval = Math.max(1, Math.round(current.interval * easeFactor))

  return {
    repetition,
    interval,
    easeFactor,
    nextReview: now + interval * DAY_MS,
    lastReviewedAt: now,
  }
}

export function isDue(nextReview: number, now = Date.now()) {
  return nextReview <= now
}
