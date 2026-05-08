import { seedVocabularies, seedVocabularyId } from './learning-content'
import type {
  AppSettings,
  StorageShape,
  UserStats,
  Vocabulary,
  WordItem,
} from './types'

const defaultStats: UserStats = {
  currentStreak: 0,
  bestStreak: 0,
  totalExposures: 0,
  totalCorrect: 0,
  timeInLanguageContactMs: 0,
  dailyReviewHistory: [],
}

const defaultSettings: AppSettings = {
  uiLanguage: 'ru',
  frequency: 3,
  newTabTriggerEnabled: true,
  navigationTriggerEnabled: true,
  cooldownMinutes: 5,
  quietHours: {
    enabled: false,
    startHour: 22,
    endHour: 8,
  },
}

export const defaultStorage: StorageShape = {
  vocabularies: seedVocabularies,
  activeVocabularyId: seedVocabularyId,
  userStats: defaultStats,
  settings: defaultSettings,
  newTabCount: 0,
  navigationCount: 0,
  pendingTrigger: null,
}

type LegacyStorageShape = Partial<StorageShape> & {
  wordBank?: unknown
}

const storageKeys = [
  'vocabularies',
  'activeVocabularyId',
  'userStats',
  'settings',
  'newTabCount',
  'navigationCount',
  'pendingTrigger',
  'wordBank',
] satisfies (keyof LegacyStorageShape)[]

export async function ensureStorage() {
  const current = (await chrome.storage.local.get(
    storageKeys,
  )) as LegacyStorageShape
  const patch = buildStoragePatch(current)

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch)
  }
}

export async function getStorage(): Promise<StorageShape> {
  await ensureStorage()
  const storage = (await chrome.storage.local.get(
    storageKeys,
  )) as LegacyStorageShape
  const normalized = normalizeStorage(storage)

  return normalized
}

function buildStoragePatch(current: LegacyStorageShape): Partial<StorageShape> {
  const normalized = normalizeStorage(current)
  const patch: Partial<StorageShape> = {}

  if (!areValidVocabularies(current.vocabularies)) {
    patch.vocabularies = normalized.vocabularies
  }

  if (
    typeof current.activeVocabularyId !== 'string' ||
    !normalized.vocabularies.some(
      (vocabulary) => vocabulary.id === current.activeVocabularyId,
    )
  ) {
    patch.activeVocabularyId = normalized.activeVocabularyId
  }

  if (
    current.settings?.navigationTriggerEnabled === undefined ||
    current.settings?.uiLanguage !== 'ru'
  ) {
    patch.settings = normalized.settings
  }

  if (!isUserStats(current.userStats)) {
    patch.userStats = normalized.userStats
  }

  if (typeof current.newTabCount !== 'number') {
    patch.newTabCount = normalized.newTabCount
  }

  if (typeof current.navigationCount !== 'number') {
    patch.navigationCount = normalized.navigationCount
  }

  if (current.pendingTrigger === undefined) {
    patch.pendingTrigger = normalized.pendingTrigger
  }

  return patch
}

function normalizeStorage(storage: LegacyStorageShape): StorageShape {
  const vocabularies = normalizeVocabularies(storage)
  const activeVocabularyId = vocabularies.some(
    (vocabulary) => vocabulary.id === storage.activeVocabularyId,
  )
    ? (storage.activeVocabularyId as string)
    : (vocabularies[0]?.id ?? seedVocabularyId)

  return {
    vocabularies,
    activeVocabularyId,
    userStats: normalizeUserStats(storage.userStats),
    settings: {
      ...defaultSettings,
      ...storage.settings,
      uiLanguage: 'ru' as const,
    },
    newTabCount:
      typeof storage.newTabCount === 'number' ? storage.newTabCount : 0,
    navigationCount:
      typeof storage.navigationCount === 'number' ? storage.navigationCount : 0,
    pendingTrigger: storage.pendingTrigger ?? null,
  }
}

function normalizeVocabularies(storage: LegacyStorageShape): Vocabulary[] {
  if (areValidVocabularies(storage.vocabularies)) {
    return storage.vocabularies
  }

  if (
    Array.isArray(storage.wordBank) &&
    storage.wordBank.every(isCurrentWordShape)
  ) {
    const now = Date.now()
    const seedVocabulary = seedVocabularies[0]
    return [
      {
        id: seedVocabulary?.id ?? seedVocabularyId,
        name: seedVocabulary?.name ?? 'Базовый словарь',
        ...(seedVocabulary?.description
          ? { description: seedVocabulary.description }
          : {}),
        category: seedVocabulary?.category ?? 'mixed',
        isBuiltin: seedVocabulary?.isBuiltin ?? true,
        createdAt: now,
        updatedAt: now,
        words: storage.wordBank.map(removeLegacyDistractors),
      },
    ]
  }

  return seedVocabularies
}

function normalizeUserStats(userStats: unknown): UserStats {
  if (!isUserStats(userStats)) return defaultStats

  return {
    ...defaultStats,
    ...userStats,
    dailyReviewHistory: Array.isArray(userStats.dailyReviewHistory)
      ? userStats.dailyReviewHistory
      : [],
  }
}

function areValidVocabularies(value: unknown): value is Vocabulary[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (vocabulary) =>
        isVocabularyLike(vocabulary) &&
        typeof vocabulary.id === 'string' &&
        typeof vocabulary.name === 'string' &&
        typeof vocabulary.category === 'string' &&
        typeof vocabulary.isBuiltin === 'boolean' &&
        typeof vocabulary.createdAt === 'number' &&
        typeof vocabulary.updatedAt === 'number' &&
        Array.isArray(vocabulary.words) &&
        vocabulary.words.every(isCurrentWordShape),
    )
  )
}

function isCurrentWordShape(word: unknown): word is WordItem {
  return (
    isWordLike(word) &&
    typeof word.id === 'string' &&
    typeof word.sourceText === 'string' &&
    typeof word.targetText === 'string' &&
    typeof word.sourceLabel === 'string' &&
    typeof word.targetLabel === 'string' &&
    isSrsLike(word.srs)
  )
}

function removeLegacyDistractors(word: WordItem): WordItem {
  const { distractors: _distractors, ...currentWord } = word as WordItem & {
    distractors?: string[]
  }
  return currentWord
}

function isUserStats(value: unknown): value is UserStats {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dailyReviewHistory' in value &&
    Array.isArray((value as UserStats).dailyReviewHistory)
  )
}

function isSrsLike(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WordItem['srs']).repetition === 'number' &&
    typeof (value as WordItem['srs']).interval === 'number' &&
    typeof (value as WordItem['srs']).easeFactor === 'number' &&
    typeof (value as WordItem['srs']).nextReview === 'number'
  )
}

function isVocabularyLike(value: unknown): value is Partial<Vocabulary> {
  return typeof value === 'object' && value !== null
}

function isWordLike(value: unknown): value is Partial<WordItem> {
  return typeof value === 'object' && value !== null
}

export async function updateStorage(patch: Partial<StorageShape>) {
  await chrome.storage.local.set(patch)
}
