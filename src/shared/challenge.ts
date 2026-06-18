import { calculateNextSrs, isDue, qualityFromResult } from './srs'
import type {
  ChallengePayload,
  ChallengeResult,
  StorageShape,
  TriggerSource,
  WordItem,
} from './types'

export function shouldBlockForUserSettings(storage: StorageShape, now = Date.now()) {
  return (
    isDisabled(storage.settings.disabledUntil, now) ||
    isQuietTime(storage.settings.quietHours, new Date(now)) ||
    isCoolingDown(
      storage.userStats.lastChallengeAt,
      storage.settings.cooldownMinutes,
      now,
    )
  )
}

export function buildChallengePayload(
  source: TriggerSource,
  word: WordItem,
  now = Date.now(),
): ChallengePayload {
  return {
    source,
    word,
    options: shuffle([word.targetText, ...shuffle(word.distractors).slice(0, 3)]),
    startedAt: now,
  }
}

export function applyChallengeResult(
  storage: StorageShape,
  result: ChallengeResult,
  now = Date.now(),
): Pick<StorageShape, 'wordBank' | 'userStats'> {
  return {
    wordBank: storage.wordBank.map((word) => {
      if (word.id !== result.wordId) return word
      return {
        ...word,
        srs: calculateNextSrs(word.srs, qualityFromResult(result), now),
      }
    }),
    userStats: {
      ...storage.userStats,
      totalExposures: storage.userStats.totalExposures + 1,
      totalCorrect: storage.userStats.totalCorrect + (result.wasCorrect ? 1 : 0),
      timeInLanguageContactMs:
        storage.userStats.timeInLanguageContactMs + result.elapsedMs,
    },
  }
}

export function pickDueWord(words: WordItem[], now = Date.now()) {
  const dueWords = words.filter((word) => isDue(word.srs.nextReview, now))
  const candidates = dueWords.length > 0 ? dueWords : words
  return randomItem(candidates)
}

export function isCoolingDown(
  lastChallengeAt: number | undefined,
  cooldownMinutes: number,
  now = Date.now(),
) {
  if (!lastChallengeAt) return false
  return now - lastChallengeAt < cooldownMinutes * 60 * 1000
}

export function isDisabled(disabledUntil: number | undefined, now = Date.now()) {
  return typeof disabledUntil === 'number' && disabledUntil > now
}

export function isQuietTime(
  quietHours: StorageShape['settings']['quietHours'],
  date = new Date(),
) {
  if (!quietHours.enabled) return false
  const hour = date.getHours()
  const { startHour, endHour } = quietHours

  if (startHour < endHour) {
    return hour >= startHour && hour < endHour
  }

  return hour >= startHour || hour < endHour
}

function randomItem<T>(items: readonly T[]) {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

function shuffle<T>(items: readonly T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}
