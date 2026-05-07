import { defaultWords } from './learning-content'
import type { AppSettings, StorageShape, UserStats, WordItem } from './types'

const defaultStats: UserStats = {
  currentStreak: 0,
  bestStreak: 0,
  totalExposures: 0,
  totalCorrect: 0,
  timeInLanguageContactMs: 0,
  dailyReviewHistory: [],
}

const defaultSettings: AppSettings = {
  frequency: 3,
  idleTriggerEnabled: true,
  newTabTriggerEnabled: true,
  navigationTriggerEnabled: true,
  cooldownMinutes: 5,
  quietHours: {
    enabled: false,
    startHour: 22,
    endHour: 8,
  },
  overlayTheme: 'system',
}

export const defaultStorage: StorageShape = {
  wordBank: defaultWords,
  userStats: defaultStats,
  settings: defaultSettings,
  newTabCount: 0,
  navigationCount: 0,
  pendingTrigger: undefined,
}

export async function ensureStorage() {
  const storageKeys = Object.keys(defaultStorage) as (keyof StorageShape)[]
  const current = await chrome.storage.local.get(storageKeys)
  const patch = Object.fromEntries(
    Object.entries(defaultStorage).filter(
      ([key]) => current[key] === undefined,
    ),
  )

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch)
  }
}

export async function getStorage(): Promise<StorageShape> {
  await ensureStorage()
  const storageKeys = Object.keys(defaultStorage) as (keyof StorageShape)[]
  const storage = (await chrome.storage.local.get(storageKeys)) as StorageShape

  const nextSettings = { ...defaultSettings, ...storage.settings }
  if (storage.settings?.navigationTriggerEnabled === undefined) {
    storage.settings = nextSettings
    await chrome.storage.local.set({ settings: nextSettings })
  }

  if (typeof storage.navigationCount !== 'number') {
    storage.navigationCount = 0
    await chrome.storage.local.set({ navigationCount: 0 })
  }

  if (!Array.isArray(storage.userStats.dailyReviewHistory)) {
    storage.userStats = {
      ...defaultStats,
      ...storage.userStats,
      dailyReviewHistory: [],
    }
    await chrome.storage.local.set({ userStats: storage.userStats })
  }

  if (
    !Array.isArray(storage.wordBank) ||
    !storage.wordBank.every(isCurrentWordShape)
  ) {
    storage.wordBank = defaultWords
    await chrome.storage.local.set({ wordBank: defaultWords })
  }

  return storage
}

function isCurrentWordShape(word: unknown): word is WordItem {
  return (
    isWordLike(word) &&
    typeof word.sourceText === 'string' &&
    typeof word.targetText === 'string' &&
    typeof word.sourceLabel === 'string' &&
    typeof word.targetLabel === 'string' &&
    Array.isArray(word.distractors) &&
    word.distractors.length >= 3
  )
}

function isWordLike(value: unknown): value is {
  sourceText?: unknown
  targetText?: unknown
  sourceLabel?: unknown
  targetLabel?: unknown
  distractors?: unknown
} {
  return typeof value === 'object' && value !== null
}

export async function updateStorage(patch: Partial<StorageShape>) {
  await chrome.storage.local.set(patch)
}
