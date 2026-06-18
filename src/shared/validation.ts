import type {
  AppSettings,
  ChallengePayload,
  ChallengeResult,
  DailyReviewEntry,
  QuietHours,
  ScriptVariant,
  SrsData,
  StorageShape,
  TriggerSource,
  UserStats,
  Vocabulary,
  VocabularyCategory,
  WordItem,
} from './types'

const triggerSources = ['new-tab', 'navigation', 'demo-hotkey'] as const
const challengeDirections = ['source-to-target', 'target-to-source'] as const
const scriptVariants = ['latin', 'cyrillic'] as const
const wordLevels = ['A1', 'A2'] as const
const vocabularyCategories = [
  'nouns',
  'verbs',
  'grammar',
  'mixed',
  'custom',
] as const

export function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export function isTriggerSource(value: unknown): value is TriggerSource {
  return includesString(triggerSources, value)
}

export function isVocabularyCategory(
  value: unknown,
): value is VocabularyCategory {
  return includesString(vocabularyCategories, value)
}

export function isScriptVariant(value: unknown): value is ScriptVariant {
  if (!isRecord(value)) return false
  const candidate = value as Partial<ScriptVariant>
  return (
    includesString(scriptVariants, candidate.script) &&
    typeof candidate.text === 'string'
  )
}

export function isSrsData(value: unknown): value is SrsData {
  if (!isRecord(value)) return false
  const candidate = value as Partial<SrsData>
  return (
    typeof candidate.repetition === 'number' &&
    typeof candidate.interval === 'number' &&
    typeof candidate.easeFactor === 'number' &&
    typeof candidate.nextReview === 'number' &&
    optionalNumber(candidate.lastReviewedAt)
  )
}

export function isWordItem(value: unknown): value is WordItem {
  if (!isRecord(value)) return false
  const candidate = value as Partial<WordItem>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.sourceText === 'string' &&
    typeof candidate.targetText === 'string' &&
    typeof candidate.sourceLabel === 'string' &&
    typeof candidate.targetLabel === 'string' &&
    optionalArray(candidate.sourceVariants, isScriptVariant) &&
    optionalArray(candidate.targetVariants, isScriptVariant) &&
    includesString(wordLevels, candidate.level) &&
    isSrsData(candidate.srs)
  )
}

export function isVocabulary(value: unknown): value is Vocabulary {
  if (!isRecord(value)) return false
  const candidate = value as Partial<Vocabulary>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    optionalString(candidate.description) &&
    isVocabularyCategory(candidate.category) &&
    typeof candidate.isBuiltin === 'boolean' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number' &&
    Array.isArray(candidate.words) &&
    candidate.words.every(isWordItem)
  )
}

export function isQuietHours(value: unknown): value is QuietHours {
  if (!isRecord(value)) return false
  const candidate = value as Partial<QuietHours>
  return (
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.startHour === 'number' &&
    typeof candidate.endHour === 'number'
  )
}

export function isAppSettings(value: unknown): value is AppSettings {
  if (!isRecord(value)) return false
  const candidate = value as Partial<AppSettings>
  return (
    candidate.uiLanguage === 'ru' &&
    typeof candidate.frequency === 'number' &&
    typeof candidate.newTabTriggerEnabled === 'boolean' &&
    typeof candidate.navigationTriggerEnabled === 'boolean' &&
    typeof candidate.analyticsEnabled === 'boolean' &&
    typeof candidate.cooldownMinutes === 'number' &&
    isQuietHours(candidate.quietHours) &&
    optionalNumber(candidate.disabledUntil)
  )
}

export function isDailyReviewEntry(value: unknown): value is DailyReviewEntry {
  if (!isRecord(value)) return false
  const candidate = value as Partial<DailyReviewEntry>
  return (
    typeof candidate.date === 'string' &&
    typeof candidate.count === 'number' &&
    typeof candidate.correct === 'number'
  )
}

export function isUserStats(value: unknown): value is UserStats {
  if (!isRecord(value)) return false
  const candidate = value as Partial<UserStats>
  return (
    typeof candidate.currentStreak === 'number' &&
    typeof candidate.bestStreak === 'number' &&
    typeof candidate.totalExposures === 'number' &&
    typeof candidate.totalCorrect === 'number' &&
    typeof candidate.timeInLanguageContactMs === 'number' &&
    Array.isArray(candidate.dailyReviewHistory) &&
    candidate.dailyReviewHistory.every(isDailyReviewEntry) &&
    optionalNumber(candidate.lastChallengeAt)
  )
}

export function isStorageShape(value: unknown): value is StorageShape {
  if (!isRecord(value)) return false
  const candidate = value as Partial<StorageShape>
  return (
    Array.isArray(candidate.vocabularies) &&
    candidate.vocabularies.length > 0 &&
    candidate.vocabularies.every(isVocabulary) &&
    typeof candidate.activeVocabularyId === 'string' &&
    candidate.vocabularies.some(
      (vocabulary) => vocabulary.id === candidate.activeVocabularyId,
    ) &&
    isUserStats(candidate.userStats) &&
    isAppSettings(candidate.settings) &&
    typeof candidate.newTabCount === 'number' &&
    typeof candidate.navigationCount === 'number' &&
    (candidate.pendingTrigger === undefined ||
      candidate.pendingTrigger === null ||
      isTriggerSource(candidate.pendingTrigger))
  )
}

export function isChallengePayload(value: unknown): value is ChallengePayload {
  if (!isRecord(value)) return false
  const candidate = value as Partial<ChallengePayload>
  return (
    isTriggerSource(candidate.source) &&
    isWordItem(candidate.word) &&
    includesString(challengeDirections, candidate.direction) &&
    typeof candidate.promptText === 'string' &&
    typeof candidate.answerText === 'string' &&
    Array.isArray(candidate.options) &&
    candidate.options.every((option) => typeof option === 'string') &&
    typeof candidate.startedAt === 'number'
  )
}

export function isChallengeResult(value: unknown): value is ChallengeResult {
  if (!isRecord(value)) return false
  const candidate = value as Partial<ChallengeResult>
  return (
    typeof candidate.wordId === 'string' &&
    isTriggerSource(candidate.source) &&
    typeof candidate.elapsedMs === 'number' &&
    typeof candidate.wasSkipped === 'boolean' &&
    typeof candidate.wasCorrect === 'boolean' &&
    typeof candidate.timedOut === 'boolean'
  )
}

function includesString<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && values.includes(value)
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === 'string'
}

function optionalNumber(value: unknown) {
  return value === undefined || typeof value === 'number'
}

function optionalArray<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T,
): value is T[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(itemGuard))
}
