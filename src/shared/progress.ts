import { answeredCount, dateKey, isActiveDay, startOfDay } from './activity'
import type { StorageShape, WordItem } from './types'

export interface ProgressDay {
  key: string
  date: Date
  /** Interaction time; null when the day predates time tracking. */
  durationMs: number | null
  answered: number
  correct: number
  studied: number
  /** Share of answered challenges that were correct; null without answers. */
  accuracy: number | null
  active: boolean
}

export function buildProgressDays(
  history: StorageShape['userStats']['dailyReviewHistory'],
  days: number,
  now = Date.now(),
): ProgressDay[] {
  const byDate = new Map(history.map((entry) => [entry.date, entry]))
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, index) => {
    // Step by calendar day so daylight-saving changes cannot skip a date.
    const date = new Date(today)
    date.setDate(date.getDate() - (days - 1 - index))
    const key = dateKey(date.getTime())
    const entry = byDate.get(key)
    const answered = entry ? answeredCount(entry) : 0
    const correct = entry?.correct ?? 0
    const active = entry ? isActiveDay(entry) : false
    return {
      key,
      date,
      durationMs: entry?.durationMs ?? (active ? null : 0),
      answered,
      correct,
      studied: entry?.studied ?? 0,
      accuracy: answered > 0 ? Math.min(1, correct / answered) : null,
      active,
    }
  })
}

export function periodAccuracy(days: ProgressDay[]) {
  const answered = days.reduce((sum, day) => sum + day.answered, 0)
  const correct = days.reduce((sum, day) => sum + day.correct, 0)
  return answered > 0 ? Math.min(1, correct / answered) : null
}

export function formatInteraction(ms: number) {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return { value: String(minutes), unit: 'мин' }
  const hours = ms / 3_600_000
  return {
    value: new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: hours < 10 ? 1 : 0,
    }).format(hours),
    unit: 'ч',
  }
}

export type MasteryLevel = 'mastered' | 'in-progress' | 'new'

export function isMastered(word: WordItem) {
  return word.srs.repetition >= 3 && word.srs.interval > 7
}

export function masteryLevel(word: WordItem): MasteryLevel {
  if (isMastered(word)) return 'mastered'
  if (word.srs.lastReviewedAt) return 'in-progress'
  return 'new'
}

export function masteryLabel(word: WordItem) {
  const level = masteryLevel(word)
  if (level === 'mastered') return 'освоено'
  if (level === 'in-progress') return `в работе · ${word.srs.repetition}/3`
  return 'новое'
}
