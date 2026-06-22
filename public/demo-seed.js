/**
 * Demo data seed for the extension's DevTools console.
 *
 * Run from an extension page (for example dashboard.html):
 * await import(chrome.runtime.getURL('demo-seed.js')).then(({ seedDemo }) => seedDemo())
 */

const DAY_MS = 24 * 60 * 60 * 1000
const DEMO_DAYS = 30

function startOfDay(time) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dateKey(time) {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildReviewHistory(now) {
  const today = startOfDay(now)

  return Array.from({ length: DEMO_DAYS }, (_, index) => {
    const dayIndex = DEMO_DAYS - 1 - index
    const count = 8 + ((index * 7) % 13)
    const correct = count - (index % 5 === 0 ? 2 : 1)

    return {
      date: dateKey(today - dayIndex * DAY_MS),
      count,
      correct,
    }
  })
}

function seedVocabulary(vocabulary, now) {
  const learnedCount = Math.ceil(vocabulary.words.length / 2)

  return {
    ...vocabulary,
    updatedAt: now,
    words: vocabulary.words.map((word, index) => {
      if (index >= learnedCount) return word

      const reviewedAt = startOfDay(now) - ((index % 24) + 2) * DAY_MS
      const interval = 12 + (index % 8)

      return {
        ...word,
        srs: {
          repetition: 3 + (index % 3),
          interval,
          easeFactor: 2.5 + (index % 4) * 0.1,
          lastReviewedAt: reviewedAt,
          nextReview: reviewedAt + interval * DAY_MS,
        },
      }
    }),
  }
}

export async function seedDemo() {
  if (!globalThis.chrome?.storage?.local) {
    throw new Error('Run this from the DevTools console of an extension page.')
  }

  const now = Date.now()
  const current = await chrome.storage.local.get([
    'vocabularies',
    'settings',
    'newTabCount',
    'navigationCount',
  ])

  if (
    !Array.isArray(current.vocabularies) ||
    current.vocabularies.length === 0
  ) {
    throw new Error(
      'No vocabulary found. Open the extension once before seeding demo data.',
    )
  }

  const dailyReviewHistory = buildReviewHistory(now)
  const totalExposures = dailyReviewHistory.reduce(
    (total, entry) => total + entry.count,
    0,
  )
  const totalCorrect = dailyReviewHistory.reduce(
    (total, entry) => total + entry.correct,
    0,
  )
  const vocabularies = current.vocabularies.map((vocabulary) =>
    seedVocabulary(vocabulary, now),
  )

  await chrome.storage.local.set({
    vocabularies,
    settings: {
      ...current.settings,
      analyticsEnabled: false,
    },
    userStats: {
      currentStreak: DEMO_DAYS,
      bestStreak: DEMO_DAYS,
      totalExposures,
      totalCorrect,
      timeInLanguageContactMs: totalExposures * 4200,
      dailyReviewHistory,
      lastChallengeAt: now - 5 * 60 * 1000,
    },
    newTabCount:
      typeof current.newTabCount === 'number' ? current.newTabCount : 0,
    navigationCount:
      typeof current.navigationCount === 'number' ? current.navigationCount : 0,
    pendingTrigger: null,
    // Disable any chance of sending previously queued opt-in analytics.
    statsPendingEvents: [],
    statsPendingSnapshots: [],
  })
  await chrome.storage.local.remove('statsLastSnapshotDate')

  const learnedWords = vocabularies.reduce(
    (total, vocabulary) => total + Math.ceil(vocabulary.words.length / 2),
    0,
  )
  const totalWords = vocabularies.reduce(
    (total, vocabulary) => total + vocabulary.words.length,
    0,
  )
  const summary = {
    learnedWords,
    totalWords,
    activityDays: DEMO_DAYS,
    totalExposures,
    analyticsEnabled: false,
  }

  console.info('[Bir Söz] Demo data seeded', summary)
  return summary
}
