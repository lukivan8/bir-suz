export interface SrsData {
  repetition: number
  interval: number
  easeFactor: number
  nextReview: number
  lastReviewedAt?: number
}

export interface ScriptVariant {
  script: 'latin' | 'cyrillic'
  text: string
}

export interface WordItem {
  id: string
  sourceText: string
  targetText: string
  sourceLabel: string
  targetLabel: string
  sourceVariants?: ScriptVariant[]
  targetVariants?: ScriptVariant[]
  level: 'A1' | 'A2' | 'B1'
  srs: SrsData
}

export type VocabularyCategory =
  | 'nouns'
  | 'verbs'
  | 'grammar'
  | 'mixed'
  | 'custom'

export interface Vocabulary {
  id: string
  name: string
  description?: string
  category: VocabularyCategory
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
  words: WordItem[]
}

export interface DailyReviewEntry {
  date: string
  count: number
  correct: number
}

export interface UserStats {
  currentStreak: number
  bestStreak: number
  totalExposures: number
  totalCorrect: number
  timeInLanguageContactMs: number
  dailyReviewHistory: DailyReviewEntry[]
  lastChallengeAt?: number
}

export interface QuietHours {
  enabled: boolean
  startHour: number
  endHour: number
}

export type UiLanguage = 'ru'

export interface AppSettings {
  uiLanguage: UiLanguage
  frequency: number
  newTabTriggerEnabled: boolean
  navigationTriggerEnabled: boolean
  analyticsEnabled: boolean
  cooldownMinutes: number
  quietHours: QuietHours
  disabledUntil?: number | undefined
}

export interface StorageShape {
  vocabularies: Vocabulary[]
  activeVocabularyId: string
  userStats: UserStats
  settings: AppSettings
  newTabCount: number
  navigationCount: number
  pendingTrigger?: TriggerSource | null | undefined
}

export type TriggerSource = 'new-tab' | 'navigation' | 'demo-hotkey'

export type ChallengeDirection = 'source-to-target' | 'target-to-source'

export interface ChallengePayload {
  source: TriggerSource
  word: WordItem
  direction: ChallengeDirection
  promptText: string
  answerText: string
  options: string[]
  startedAt: number
}

export interface ChallengeResult {
  wordId: string
  source: TriggerSource
  elapsedMs: number
  wasSkipped: boolean
  wasCorrect: boolean
  timedOut: boolean
}
