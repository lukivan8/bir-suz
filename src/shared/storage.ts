import type { AppSettings, StorageShape, UserStats, WordItem } from './types'

const defaultWords: WordItem[] = [
  {
    id: 'kk_001',
    kk: 'Сәлем',
    ru: 'Привет',
    distractors: ['Пока', 'Дом', 'Книга'],
    level: 'A1',
    srs: { repetition: 0, interval: 1, easeFactor: 2.5, nextReview: 0 },
  },
  {
    id: 'kk_002',
    kk: 'Рақмет',
    ru: 'Спасибо',
    distractors: ['Здравствуйте', 'Урок', 'Время'],
    level: 'A1',
    srs: { repetition: 0, interval: 1, easeFactor: 2.5, nextReview: 0 },
  },
  {
    id: 'kk_003',
    kk: 'Кітап',
    ru: 'Книга',
    distractors: ['Окно', 'Учитель', 'Работа'],
    level: 'A1',
    srs: { repetition: 0, interval: 1, easeFactor: 2.5, nextReview: 0 },
  },
  {
    id: 'kk_004',
    kk: 'Жұмыс',
    ru: 'Работа',
    distractors: ['Школа', 'Спасибо', 'Вода'],
    level: 'A1',
    srs: { repetition: 0, interval: 1, easeFactor: 2.5, nextReview: 0 },
  },
]

const defaultStats: UserStats = {
  currentStreak: 0,
  bestStreak: 0,
  totalExposures: 0,
  totalCorrect: 0,
  timeInLanguageContactMs: 0,
}

const defaultSettings: AppSettings = {
  frequency: 3,
  idleTriggerEnabled: true,
  newTabTriggerEnabled: true,
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
  return (await chrome.storage.local.get(storageKeys)) as StorageShape
}

export async function updateStorage(patch: Partial<StorageShape>) {
  await chrome.storage.local.set(patch)
}
