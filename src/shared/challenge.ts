import { calculateNextSrs, isDue, qualityFromResult } from './srs'
import type {
  ChallengePayload,
  ChallengeResult,
  StorageShape,
  TriggerSource,
  WordItem,
} from './types'

export function shouldBlockForUserSettings(
  storage: StorageShape,
  now = Date.now(),
) {
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
    options: shuffle([
      word.targetText,
      ...shuffle(word.distractors).slice(0, 3),
    ]),
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
    userStats: buildNextStats(storage, result, now),
  }
}

function buildNextStats(
  storage: StorageShape,
  result: ChallengeResult,
  now: number,
): StorageShape['userStats'] {
  const dailyReviewHistory = updateDailyHistory(
    storage.userStats.dailyReviewHistory,
    result.wasCorrect,
    now,
  )

  return {
    ...storage.userStats,
    currentStreak: calculateCurrentStreak(dailyReviewHistory, now),
    bestStreak: Math.max(
      storage.userStats.bestStreak,
      calculateBestStreak(dailyReviewHistory),
    ),
    dailyReviewHistory,
    totalExposures: storage.userStats.totalExposures + 1,
    totalCorrect: storage.userStats.totalCorrect + (result.wasCorrect ? 1 : 0),
    timeInLanguageContactMs:
      storage.userStats.timeInLanguageContactMs + result.elapsedMs,
  }
}

function updateDailyHistory(
  history: StorageShape['userStats']['dailyReviewHistory'],
  wasCorrect: boolean,
  now: number,
) {
  const today = dateKey(now)
  const existing = history.find((entry) => entry.date === today)
  if (existing) {
    return history.map((entry) =>
      entry.date === today
        ? {
            ...entry,
            count: entry.count + 1,
            correct: entry.correct + (wasCorrect ? 1 : 0),
          }
        : entry,
    )
  }

  return [
    ...history,
    { date: today, count: 1, correct: wasCorrect ? 1 : 0 },
  ].slice(-90)
}

export function calculateCurrentStreak(
  history: StorageShape['userStats']['dailyReviewHistory'],
  now = Date.now(),
) {
  const activeDays = new Set(
    history.filter((entry) => entry.count > 0).map((entry) => entry.date),
  )
  let streak = 0
  let cursor = startOfDay(now)

  while (activeDays.has(dateKey(cursor))) {
    streak += 1
    cursor -= 24 * 60 * 60 * 1000
  }

  return streak
}

export function calculateBestStreak(
  history: StorageShape['userStats']['dailyReviewHistory'],
) {
  const days = history
    .filter((entry) => entry.count > 0)
    .map((entry) => entry.date)
    .sort()

  let best = 0
  let current = 0
  let previous = ''

  for (const day of days) {
    current = previous && daysBetween(previous, day) === 1 ? current + 1 : 1
    best = Math.max(best, current)
    previous = day
  }

  return best
}

function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00`).getTime() -
      new Date(`${start}T00:00:00`).getTime()) /
      (24 * 60 * 60 * 1000),
  )
}

function dateKey(time: number) {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(time: number) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
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

export function isDisabled(
  disabledUntil: number | undefined,
  now = Date.now(),
) {
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
