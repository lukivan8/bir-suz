import { nextActivityStats } from './activity'
import { calculateNextSrs, isDue, qualityFromResult } from './srs'
import type {
  ChallengePayload,
  ChallengeResult,
  StorageShape,
  TriggerSource,
  WordItem,
} from './types'
import { updateActiveVocabularyWords } from './vocabularies'

export { calculateBestStreak, calculateCurrentStreak } from './activity'

export function shouldBlockForUserSettings(
  storage: StorageShape,
  now = Date.now(),
) {
  return (
    isDisabled(storage.settings.disabledUntil, now) ||
    isQuietTime(storage.settings.quietHours, new Date(now)) ||
    isCoolingDown(
      storage.userStats.lastChallengeAt,
      storage.settings.cooldownMinutes,
      now,
    )
  )
}

export function buildChallengePayload(
  source: TriggerSource,
  word: WordItem,
  vocabularyWords: WordItem[],
  now = Date.now(),
): ChallengePayload {
  const direction =
    Math.random() < 1 / 3 ? 'target-to-source' : 'source-to-target'
  const promptText =
    direction === 'target-to-source' ? word.targetText : word.sourceText
  const answerText =
    direction === 'target-to-source' ? word.sourceText : word.targetText

  return {
    source,
    word,
    direction,
    promptText,
    answerText,
    options: buildAnswerOptions(word, vocabularyWords, direction),
    startedAt: now,
  }
}

function buildAnswerOptions(
  word: WordItem,
  vocabularyWords: WordItem[],
  direction: ChallengePayload['direction'],
) {
  const answerText =
    direction === 'target-to-source' ? word.sourceText : word.targetText
  const distractors = unique(
    shuffle(vocabularyWords)
      .filter((candidate) => candidate.id !== word.id)
      .map((candidate) =>
        direction === 'target-to-source'
          ? candidate.sourceText
          : candidate.targetText,
      )
      .filter((option) => option !== answerText),
  ).slice(0, 3)

  return shuffle([answerText, ...distractors])
}

export function applyChallengeResult(
  storage: StorageShape,
  result: ChallengeResult,
  now = Date.now(),
): Pick<StorageShape, 'vocabularies' | 'userStats' | 'remoteArchive'> {
  const update = (vocabularies: StorageShape['vocabularies']) =>
    vocabularies.map((v) =>
      v.id !== result.vocabularyId
        ? v
        : {
            ...v,
            words: v.words.map((w) =>
              w.id !== result.wordId
                ? w
                : {
                    ...w,
                    srs: calculateNextSrs(
                      w.srs,
                      qualityFromResult(result),
                      now,
                    ),
                  },
            ),
          },
    )
  return {
    remoteArchive: result.vocabularyId
      ? update(storage.remoteArchive)
      : storage.remoteArchive,
    vocabularies: result.vocabularyId
      ? update(storage.vocabularies)
      : updateActiveVocabularyWords(
          storage,
          (words) =>
            words.map((word) => {
              if (word.id !== result.wordId) return word
              return {
                ...word,
                srs: calculateNextSrs(word.srs, qualityFromResult(result), now),
              }
            }),
          now,
        ),
    userStats: buildNextStats(storage, result, now),
  }
}

function buildNextStats(
  storage: StorageShape,
  result: ChallengeResult,
  now: number,
): StorageShape['userStats'] {
  return {
    ...storage.userStats,
    ...nextActivityStats(
      storage.userStats,
      result.wasSkipped
        ? { kind: 'challenge', skipped: true }
        : {
            kind: 'challenge',
            skipped: false,
            correct: result.wasCorrect,
            durationMs: result.elapsedMs,
          },
      now,
    ),
    totalExposures: storage.userStats.totalExposures + 1,
    totalCorrect: storage.userStats.totalCorrect + (result.wasCorrect ? 1 : 0),
    lastChallengeAt: now,
  }
}

export function pickDueWord(words: WordItem[], now = Date.now()) {
  const dueWords = words.filter((word) => isDue(word.srs.nextReview, now))
  return randomItem(dueWords)
}

export function isCoolingDown(
  lastChallengeAt: number | undefined,
  cooldownMinutes: number,
  now = Date.now(),
) {
  if (!lastChallengeAt) return false
  return now - lastChallengeAt < cooldownMinutes * 60 * 1000
}

export function isDisabled(
  disabledUntil: number | undefined,
  now = Date.now(),
) {
  return typeof disabledUntil === 'number' && disabledUntil > now
}

export function isQuietTime(
  _quietHours: StorageShape['settings']['quietHours'],
  _date = new Date(),
) {
  return false
}

function randomItem<T>(items: readonly T[]) {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

function shuffle<T>(items: readonly T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function unique<T>(items: readonly T[]) {
  return [...new Set(items)]
}
