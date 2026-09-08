import { analyticsAllowed, needsAnalyticsConsent } from './analytics-consent'
import { validateProtocol } from './protocol/validate'
import { migrateRemoteVocabularies } from './remote-model'
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
  analyticsEnabled: false,
  analyticsConsentVersion: 0,
  analyticsConsentPromptVersion: 0,
  cooldownMinutes: 3,
  quietHours: {
    enabled: false,
    startHour: 22,
    endHour: 8,
  },
}

export const defaultStorage: StorageShape = {
  studySession: null,
  pendingChallenges: {},
  analyticsQueue: [],
  vocabularies: [],
  activeVocabularyId: '',
  activeVocabularyIds: [],
  organization: null,
  remoteArchive: [],
  catalogEtag: null,
  catalogVersion: null,
  lastSyncAt: null,
  onboarding: { version: 1, steps: {}, browserAnswers: 0 },
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
  'activeVocabularyIds',
  'userStats',
  'settings',
  'newTabCount',
  'navigationCount',
  'pendingTrigger',
  'wordBank',
  'organization',
  'remoteArchive',
  'catalogEtag',
  'catalogVersion',
  'lastSyncAt',
  'onboarding',
  'studySession',
  'pendingChallenges',
  'analyticsQueue',
] satisfies (keyof LegacyStorageShape)[]

export async function ensureStorage() {
  return withStorageLock(async () => {
    const current = (await chrome.storage.local.get(
      storageKeys,
    )) as LegacyStorageShape
    const patch = buildStoragePatch(current)
    if (needsAnalyticsConsent(current.settings ?? {})) {
      // Known legacy analytics queues only; keep identity and learning history.
      const legacy = await chrome.storage.local.get([
        'statsPendingEvents',
        'statsPendingSnapshots',
      ])
      for (const key of ['statsPendingEvents', 'statsPendingSnapshots']) {
        if (legacy[key] !== undefined && JSON.stringify(legacy[key]) !== '[]')
          Object.assign(patch, { [key]: [] })
      }
    }
    if (Object.keys(patch).length > 0) await chrome.storage.local.set(patch)
  })
}

export async function getStorage(): Promise<StorageShape> {
  const storage = (await chrome.storage.local.get(
    storageKeys,
  )) as LegacyStorageShape
  const normalized = normalizeStorage(storage)

  return normalized
}

function buildStoragePatch(current: LegacyStorageShape): Partial<StorageShape> {
  const normalized = normalizeStorage(current)
  const patch: Partial<StorageShape> = {}

  for (const key of [
    'vocabularies',
    'remoteArchive',
    'organization',
    'catalogEtag',
    'catalogVersion',
    'lastSyncAt',
    'onboarding',
    'studySession',
    'pendingChallenges',
    'analyticsQueue',
  ] as const) {
    if (JSON.stringify(current[key]) !== JSON.stringify(normalized[key])) {
      Object.assign(patch, { [key]: normalized[key] })
    }
  }

  if (
    typeof current.activeVocabularyId !== 'string' ||
    current.activeVocabularyId !== normalized.activeVocabularyId ||
    !normalized.vocabularies.some(
      (vocabulary) => vocabulary.id === current.activeVocabularyId,
    )
  ) {
    patch.activeVocabularyId = normalized.activeVocabularyId
  }

  if (!hasValidActiveVocabularyIds(current, normalized.vocabularies)) {
    patch.activeVocabularyIds = normalized.activeVocabularyIds
  }

  if (
    !isAppSettings(current.settings) ||
    current.settings.navigationTriggerEnabled === undefined ||
    current.settings.analyticsEnabled === undefined ||
    current.settings.uiLanguage !== 'ru' ||
    current.settings.analyticsEnabled !== normalized.settings.analyticsEnabled
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

export function normalizeStorage(storage: LegacyStorageShape): StorageShape {
  const organization =
    storage.organization &&
    validateProtocol('ConnectResponse', {
      organization: storage.organization,
      extraVocabularyEnabled: true,
    })
      ? storage.organization
      : null
  const { vocabularies, remoteArchive } = migrateRemoteVocabularies(
    normalizeVocabularies(storage),
    storage.remoteArchive ?? [],
    organization !== null,
  )
  const legacyActiveVocabularyId = vocabularies.some(
    (vocabulary) => vocabulary.id === storage.activeVocabularyId,
  )
    ? (storage.activeVocabularyId as string)
    : (vocabularies[0]?.id ?? '')
  const activeVocabularyIds = normalizeActiveVocabularyIds(
    storage.activeVocabularyIds,
    vocabularies,
    legacyActiveVocabularyId,
  )
  const activeVocabularyId = activeVocabularyIds[0] ?? legacyActiveVocabularyId

  return {
    studySession: storage.studySession ?? null,
    pendingChallenges: storage.pendingChallenges ?? {},
    analyticsQueue:
      analyticsAllowed(storage.settings ?? {}) &&
      Array.isArray(storage.analyticsQueue)
        ? storage.analyticsQueue
        : [],
    vocabularies,
    remoteArchive,
    organization,
    catalogEtag:
      typeof storage.catalogEtag === 'string' ? storage.catalogEtag : null,
    catalogVersion: Number.isInteger(storage.catalogVersion)
      ? (storage.catalogVersion ?? null)
      : null,
    lastSyncAt:
      typeof storage.lastSyncAt === 'number' ? storage.lastSyncAt : null,
    onboarding:
      storage.onboarding?.version === 1
        ? storage.onboarding
        : structuredClone(defaultStorage.onboarding),
    activeVocabularyId,
    activeVocabularyIds,
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

function normalizeActiveVocabularyIds(
  value: unknown,
  vocabularies: Vocabulary[],
  fallbackId: string,
) {
  if (!Array.isArray(value)) return fallbackId ? [fallbackId] : []

  const vocabularyIds = new Set(vocabularies.map((vocabulary) => vocabulary.id))
  const activeVocabularyIds = [...new Set(value)].filter(
    (id): id is string => typeof id === 'string' && vocabularyIds.has(id),
  )

  return activeVocabularyIds.length > 0
    ? activeVocabularyIds
    : fallbackId
      ? [fallbackId]
      : []
}

function hasValidActiveVocabularyIds(
  storage: LegacyStorageShape,
  vocabularies: Vocabulary[],
) {
  if (!Array.isArray(storage.activeVocabularyIds)) return false

  const normalized = normalizeActiveVocabularyIds(
    storage.activeVocabularyIds,
    vocabularies,
    vocabularies[0]?.id ?? '',
  )

  return (
    storage.activeVocabularyIds.length === normalized.length &&
    storage.activeVocabularyIds.every((id, index) => id === normalized[index])
  )
}

function normalizeVocabularies(storage: LegacyStorageShape): Vocabulary[] {
  if (areValidVocabularies(storage.vocabularies)) return storage.vocabularies
  if (
    Array.isArray(storage.wordBank) &&
    storage.wordBank.length > 0 &&
    storage.wordBank.every(isCurrentWordShape)
  ) {
    return [
      {
        id: 'builtin-kazakh-basic-words',
        name: 'Базовый словарь',
        category: 'mixed',
        isBuiltin: true,
        createdAt: 0,
        updatedAt: 0,
        words: storage.wordBank.map(removeLegacyDistractors),
      },
    ]
  }
  return []
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
    analyticsEnabled: analyticsAllowed(settings),
    analyticsConsentVersion:
      typeof settings.analyticsConsentVersion === 'number'
        ? settings.analyticsConsentVersion
        : 0,
    analyticsConsentPromptVersion:
      typeof settings.analyticsConsentPromptVersion === 'number'
        ? settings.analyticsConsentPromptVersion
        : 0,
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
  return Array.isArray(value) && value.every(isVocabulary)
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
  await chrome.storage.local.set(
    patch.settings?.analyticsEnabled === false
      ? { ...patch, analyticsQueue: [] }
      : patch,
  )
}

/** Cross-context lock shared by worker, popup and dashboard read-modify-write. */
export function withStorageLock<T>(run: () => Promise<T>): Promise<T> {
  return navigator.locks.request('bir-soz-storage', run)
}
