export interface SrsData {
  repetition: number
  interval: number
  easeFactor: number
  nextReview: number
  lastReviewedAt?: number
}

export interface WordItem {
  id: string
  sourceText: string
  targetText: string
  distractors: string[]
  level: 'A1' | 'A2'
  srs: SrsData
}

export interface UserStats {
  currentStreak: number
  bestStreak: number
  totalExposures: number
  totalCorrect: number
  timeInLanguageContactMs: number
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
  cooldownMinutes: number
  quietHours: QuietHours
  disabledUntil?: number
  overlayTheme: 'light' | 'dark' | 'system'
}

export interface StorageShape {
  wordBank: WordItem[]
  userStats: UserStats
  settings: AppSettings
  newTabCount: number
  pendingTrigger?: TriggerSource
}

export type TriggerSource = 'new-tab' | 'idle-return' | 'demo-hotkey'

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
