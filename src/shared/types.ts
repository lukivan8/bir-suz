import type { AnalyticsEventV2, ConnectResponse } from './api-contract'

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
  isRemote?: boolean
  remoteVersion?: number
  requiresOrganization?: boolean
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

export interface OnboardingState {
  version: 1
  steps: Record<string, 'completed' | 'skipped'>
  browserAnswers: number
  runId?: string
  browserStepStartedAt?: number
  returnedAt?: number
}

export type Confidence = -2 | -1 | 0 | 1 | 2
export interface StudyCard {
  vocabularyId: string
  vocabularyName: string
  isRemote: boolean
  word: WordItem
}
export interface StudyRating {
  index: number
  confidence: Confidence
  durationMs: number
  srs: SrsData
}
export interface StudySession {
  id: string
  onboarding: boolean
  onboardingRunId?: string | undefined
  cards: StudyCard[]
  index: number
  results: StudyRating[]
  shownAt: number | null
  flipped: boolean
  completedAt: number | null
}

export interface PendingChallenge {
  id: string
  vocabularyId: string
  wordId: string
  source: TriggerSource
  tabId: number
  createdAt: number
  onboardingRunId?: string | undefined
}

export interface StorageShape {
  analyticsQueue: AnalyticsEventV2[]
  pendingChallenges: Record<string, PendingChallenge>
  studySession: StudySession | null
  organization: ConnectResponse['organization'] | null
  remoteArchive: Vocabulary[]
  catalogEtag: string | null
  catalogVersion: number | null
  lastSyncAt: number | null
  onboarding: OnboardingState
  vocabularies: Vocabulary[]
  activeVocabularyId: string
  activeVocabularyIds: string[]
  userStats: UserStats
  settings: AppSettings
  newTabCount: number
  navigationCount: number
  pendingTrigger?: TriggerSource | null | undefined
}

export type TriggerSource = 'new-tab' | 'navigation' | 'demo-hotkey'

export type ChallengeDirection = 'source-to-target' | 'target-to-source'

export interface ChallengePayload {
  challengeId?: string
  vocabularyId?: string
  source: TriggerSource
  word: WordItem
  direction: ChallengeDirection
  promptText: string
  answerText: string
  options: string[]
  startedAt: number
}

export interface ChallengeResult {
  challengeId?: string | undefined
  vocabularyId?: string | undefined
  wordId: string
  source: TriggerSource
  elapsedMs: number
  wasSkipped: boolean
  wasCorrect: boolean
  timedOut: boolean
}
