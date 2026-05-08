import { seedVocabularies, seedVocabularyId } from './learning-content'
import type {
  AppSettings,
  QuietHours,
  StorageShape,
  UserStats,
  Vocabulary,
  WordItem,
} from './types'
import {
  isAppSettings,
  isDailyReviewEntry,
  isTriggerSource,
  isUserStats,
  isVocabulary,
  isWordItem,
} from './validation'

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
  frequency: 5,
  newTabTriggerEnabled: true,
  navigationTriggerEnabled: true,
  cooldownMinutes: 3,
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

  if (
    !areValidVocabularies(current.vocabularies) ||
    !hasAllSeedVocabularies(current.vocabularies)
  ) {
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
    !isAppSettings(current.settings) ||
    current.settings.navigationTriggerEnabled === undefined ||
    current.settings.uiLanguage !== 'ru'
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
    settings: normalizeSettings(storage.settings),
    newTabCount:
      typeof storage.newTabCount === 'number' ? storage.newTabCount : 0,
    navigationCount:
      typeof storage.navigationCount === 'number' ? storage.navigationCount : 0,
    pendingTrigger: isTriggerSource(storage.pendingTrigger)
      ? storage.pendingTrigger
      : null,
  }
}

function normalizeVocabularies(storage: LegacyStorageShape): Vocabulary[] {
  if (areValidVocabularies(storage.vocabularies)) {
    return appendMissingSeedVocabularies(storage.vocabularies)
  }

  if (
    Array.isArray(storage.wordBank) &&
    storage.wordBank.every(isCurrentWordShape)
  ) {
    const now = Date.now()
    const seedVocabulary = seedVocabularies[0]
    return appendMissingSeedVocabularies([
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
    ])
  }

  return seedVocabularies
}

function appendMissingSeedVocabularies(vocabularies: Vocabulary[]) {
  const existingIds = new Set(vocabularies.map((vocabulary) => vocabulary.id))
  const missingSeedVocabularies = seedVocabularies.filter(
    (vocabulary) => !existingIds.has(vocabulary.id),
  )

  return [...vocabularies, ...missingSeedVocabularies]
}

function hasAllSeedVocabularies(vocabularies: unknown) {
  if (!areValidVocabularies(vocabularies)) return false
  const existingIds = new Set(vocabularies.map((vocabulary) => vocabulary.id))
  return seedVocabularies.every((vocabulary) => existingIds.has(vocabulary.id))
}

function normalizeSettings(settings: unknown): AppSettings {
  if (!isMaybeSettings(settings)) return defaultSettings

  const quietHours = normalizeQuietHours(settings.quietHours)

  return {
    uiLanguage: 'ru',
    frequency:
      typeof settings.frequency === 'number'
        ? settings.frequency
        : defaultSettings.frequency,
    newTabTriggerEnabled:
      typeof settings.newTabTriggerEnabled === 'boolean'
        ? settings.newTabTriggerEnabled
        : defaultSettings.newTabTriggerEnabled,
    navigationTriggerEnabled:
      typeof settings.navigationTriggerEnabled === 'boolean'
        ? settings.navigationTriggerEnabled
        : defaultSettings.navigationTriggerEnabled,
    cooldownMinutes:
      typeof settings.cooldownMinutes === 'number'
        ? settings.cooldownMinutes
        : defaultSettings.cooldownMinutes,
    quietHours,
    ...(typeof settings.disabledUntil === 'number'
      ? { disabledUntil: settings.disabledUntil }
      : {}),
  }
}

function normalizeQuietHours(quietHours: unknown): QuietHours {
  if (!isMaybeQuietHours(quietHours)) return defaultSettings.quietHours

  return {
    enabled:
      typeof quietHours.enabled === 'boolean'
        ? quietHours.enabled
        : defaultSettings.quietHours.enabled,
    startHour:
      typeof quietHours.startHour === 'number'
        ? quietHours.startHour
        : defaultSettings.quietHours.startHour,
    endHour:
      typeof quietHours.endHour === 'number'
        ? quietHours.endHour
        : defaultSettings.quietHours.endHour,
  }
}

function normalizeUserStats(userStats: unknown): UserStats {
  if (!isMaybeUserStats(userStats)) return defaultStats

  return {
    currentStreak:
      typeof userStats.currentStreak === 'number'
        ? userStats.currentStreak
        : defaultStats.currentStreak,
    bestStreak:
      typeof userStats.bestStreak === 'number'
        ? userStats.bestStreak
        : defaultStats.bestStreak,
    totalExposures:
      typeof userStats.totalExposures === 'number'
        ? userStats.totalExposures
        : defaultStats.totalExposures,
    totalCorrect:
      typeof userStats.totalCorrect === 'number'
        ? userStats.totalCorrect
        : defaultStats.totalCorrect,
    timeInLanguageContactMs:
      typeof userStats.timeInLanguageContactMs === 'number'
        ? userStats.timeInLanguageContactMs
        : defaultStats.timeInLanguageContactMs,
    dailyReviewHistory: Array.isArray(userStats.dailyReviewHistory)
      ? userStats.dailyReviewHistory.filter(isDailyReviewEntry)
      : [],
    ...(typeof userStats.lastChallengeAt === 'number'
      ? { lastChallengeAt: userStats.lastChallengeAt }
      : {}),
  }
}

function areValidVocabularies(value: unknown): value is Vocabulary[] {
  return Array.isArray(value) && value.length > 0 && value.every(isVocabulary)
}

function isCurrentWordShape(word: unknown): word is WordItem {
  return isWordItem(word)
}

function removeLegacyDistractors(word: WordItem): WordItem {
  const { distractors: _distractors, ...currentWord } = word as WordItem & {
    distractors?: string[]
  }
  return currentWord
}

function isMaybeSettings(value: unknown): value is Partial<AppSettings> {
  return typeof value === 'object' && value !== null
}

function isMaybeQuietHours(value: unknown): value is Partial<QuietHours> {
  return typeof value === 'object' && value !== null
}

function isMaybeUserStats(value: unknown): value is Partial<UserStats> {
  return typeof value === 'object' && value !== null
}

export async function updateStorage(patch: Partial<StorageShape>) {
  await chrome.storage.local.set(patch)
}
