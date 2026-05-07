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
  distractors: string[]
  level: 'A1' | 'A2'
  srs: SrsData
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

export interface AppSettings {
  frequency: number
  idleTriggerEnabled: boolean
  newTabTriggerEnabled: boolean
  navigationTriggerEnabled: boolean
  cooldownMinutes: number
  quietHours: QuietHours
  disabledUntil?: number | undefined
}

export interface StorageShape {
  wordBank: WordItem[]
  userStats: UserStats
  settings: AppSettings
  newTabCount: number
  navigationCount: number
  pendingTrigger?: TriggerSource | null | undefined
}

export type TriggerSource =
  | 'new-tab'
  | 'idle-return'
  | 'navigation'
  | 'demo-hotkey'

export interface ChallengePayload {
  source: TriggerSource
  word: WordItem
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
