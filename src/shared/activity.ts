import type { DailyReviewEntry, StorageShape } from './types'

// Mirrors bir-stats/src/queries/interaction-time.ts so local hours match the
// team dashboard: a response up to two minutes counts in full plus a fixed
// exposure allowance; a longer (timeout-like) response keeps only the allowance.
// Skips add no time.
export const MAX_REALISTIC_RESPONSE_MS = 120_000
export const EXPOSURE_ALLOWANCE_MS = 10_000

export function interactionTimeMs(responseMs: number) {
  const counted =
    Number.isFinite(responseMs) &&
    responseMs >= 0 &&
    responseMs <= MAX_REALISTIC_RESPONSE_MS
      ? responseMs
      : 0
  return EXPOSURE_ALLOWANCE_MS + counted
}

const HISTORY_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export type DailyActivity =
  | { kind: 'challenge'; skipped: true }
  | { kind: 'challenge'; skipped: false; correct: boolean; durationMs: number }
  | { kind: 'study'; durationMs: number }

/** Interaction time an activity adds, by the shared server formula. */
export function activityTimeMs(activity: DailyActivity) {
  if (activity.kind === 'challenge' && activity.skipped) return 0
  return interactionTimeMs(activity.durationMs)
}

export function recordDailyActivity(
  history: DailyReviewEntry[],
  activity: DailyActivity,
  now: number,
): DailyReviewEntry[] {
  const today = dateKey(now)
  const existing = history.find((entry) => entry.date === today) ?? {
    date: today,
    count: 0,
    correct: 0,
  }
  const next: DailyReviewEntry = { ...existing }
  if (activity.kind === 'challenge') {
    // `count` keeps its original meaning: every challenge, including skips.
    next.count += 1
    if (!activity.skipped) {
      next.answered = answeredCount(existing) + 1
      if (activity.correct) next.correct += 1
    } else if (existing.answered === undefined) {
      next.answered = answeredCount(existing)
    }
  } else {
    next.studied = (existing.studied ?? 0) + 1
  }
  next.durationMs = (existing.durationMs ?? 0) + activityTimeMs(activity)

  const others = history.filter((entry) => entry.date !== today)
  return [...others, next]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HISTORY_DAYS)
}

/** Answered (non-skipped) challenges; older entries did not separate skips. */
export function answeredCount(entry: DailyReviewEntry) {
  return entry.answered ?? entry.count
}

export function isActiveDay(entry: DailyReviewEntry) {
  return entry.count > 0 || (entry.studied ?? 0) > 0
}

export function calculateCurrentStreak(
  history: StorageShape['userStats']['dailyReviewHistory'],
  now = Date.now(),
) {
  const activeDays = new Set(
    history.filter(isActiveDay).map((entry) => entry.date),
  )
  let streak = 0
  let cursor = startOfDay(now)

  while (activeDays.has(dateKey(cursor))) {
    streak += 1
    cursor -= DAY_MS
  }

  return streak
}

export function calculateBestStreak(
  history: StorageShape['userStats']['dailyReviewHistory'],
) {
  const days = history
    .filter(isActiveDay)
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

/** Stats fields that follow from recording one activity. */
export function nextActivityStats(
  stats: StorageShape['userStats'],
  activity: DailyActivity,
  now: number,
): Pick<
  StorageShape['userStats'],
  | 'dailyReviewHistory'
  | 'currentStreak'
  | 'bestStreak'
  | 'timeInLanguageContactMs'
> {
  const dailyReviewHistory = recordDailyActivity(
    stats.dailyReviewHistory,
    activity,
    now,
  )
  return {
    dailyReviewHistory,
    currentStreak: calculateCurrentStreak(dailyReviewHistory, now),
    bestStreak: Math.max(
      stats.bestStreak,
      calculateBestStreak(dailyReviewHistory),
    ),
    timeInLanguageContactMs:
      stats.timeInLanguageContactMs + activityTimeMs(activity),
  }
}

function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00`).getTime() -
      new Date(`${start}T00:00:00`).getTime()) /
      DAY_MS,
  )
}

export function dateKey(time: number) {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfDay(time: number) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
