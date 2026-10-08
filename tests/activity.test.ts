import { test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  activityTimeMs,
  answeredCount,
  calculateBestStreak,
  calculateCurrentStreak,
  interactionTimeMs,
  nextActivityStats,
  recordDailyActivity,
} from '../src/shared/activity'
import { normalizeStorage } from '../src/shared/storage'

const day = (date: string, hour = 12) =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()

test('interaction time matches the bir-stats policy', () => {
  assert.equal(interactionTimeMs(0), 10_000)
  assert.equal(interactionTimeMs(4_000), 14_000)
  assert.equal(interactionTimeMs(120_000), 130_000)
  assert.equal(interactionTimeMs(120_001), 10_000)
  assert.equal(interactionTimeMs(-5), 10_000)
  assert.equal(interactionTimeMs(Number.NaN), 10_000)
  assert.equal(activityTimeMs({ kind: 'challenge', skipped: true }), 0)
  assert.equal(activityTimeMs({ kind: 'study', durationMs: 5_000 }), 15_000)
})

test('daily activity separates skips, answers and study cards', () => {
  const now = day('2026-10-08')
  let history = recordDailyActivity(
    [],
    { kind: 'challenge', skipped: false, correct: true, durationMs: 3_000 },
    now,
  )
  history = recordDailyActivity(
    history,
    { kind: 'challenge', skipped: true },
    now,
  )
  history = recordDailyActivity(
    history,
    { kind: 'study', durationMs: 2_000 },
    now,
  )
  assert.deepEqual(history, [
    {
      date: '2026-10-08',
      count: 2,
      correct: 1,
      answered: 1,
      studied: 1,
      durationMs: 13_000 + 12_000,
    },
  ])
})

test('legacy entries treat every challenge as answered', () => {
  const legacy = { date: '2026-10-01', count: 4, correct: 3 }
  assert.equal(answeredCount(legacy), 4)
  const [next] = recordDailyActivity(
    [legacy],
    { kind: 'challenge', skipped: true },
    day('2026-10-01'),
  )
  assert.equal(next?.count, 5)
  assert.equal(next?.answered, 4)
})

test('history stays sorted and bounded to 90 days', () => {
  const history = Array.from({ length: 90 }, (_, index) => ({
    date: new Date(2026, 0, 1 + index).toLocaleDateString('sv-SE'),
    count: 1,
    correct: 1,
  }))
  const next = recordDailyActivity(
    history,
    { kind: 'study', durationMs: 0 },
    day('2026-10-08'),
  )
  assert.equal(next.length, 90)
  assert.equal(next.at(-1)?.date, '2026-10-08')
  assert.equal(next[0]?.date, '2026-01-02')
})

test('streak counts study days', () => {
  const history = [
    { date: '2026-10-05', count: 1, correct: 0 },
    { date: '2026-10-06', count: 0, correct: 0, studied: 2 },
    { date: '2026-10-07', count: 3, correct: 2 },
  ]
  assert.equal(calculateCurrentStreak(history, day('2026-10-07')), 3)
  assert.equal(calculateCurrentStreak(history, day('2026-10-08')), 0)
  assert.equal(calculateBestStreak(history), 3)
})

test('activity stats accumulate total interaction time', () => {
  const stats = {
    ...structuredClone(normalizeStorage({}).userStats),
    timeInLanguageContactMs: 0,
    dailyReviewHistory: [],
    bestStreak: 0,
  }
  const next = nextActivityStats(
    stats,
    { kind: 'study', durationMs: 5_000 },
    day('2026-10-08'),
  )
  assert.equal(next.timeInLanguageContactMs, 15_000)
  assert.equal(next.currentStreak, 1)
  assert.equal(next.bestStreak, 1)
})
