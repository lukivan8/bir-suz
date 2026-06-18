import type { ChallengeResult, StorageShape, Vocabulary } from './types'

const STATS_BASE_URL = 'https://api.lukivan8.com'
const CLIENT_UUID_KEY = 'statsClientUuid'
const PENDING_EVENTS_KEY = 'statsPendingEvents'
const PENDING_SNAPSHOTS_KEY = 'statsPendingSnapshots'
const LAST_SNAPSHOT_DATE_KEY = 'statsLastSnapshotDate'
const MAX_EVENT_BATCH_SIZE = 50
const MAX_QUEUED_EVENTS = 1000
const MAX_QUEUED_SNAPSHOTS = 14
const LOG_PREFIX = '[Stats Sending]'

let flushInFlight = false
let flushRequestedAgain = false

export type StatsEventType = 'answered' | 'skipped' | 'disabled' | 'enabled'

type AnalyticsEndpoint = '/api/events' | '/api/snapshot'

interface AnalyticsVocabulary {
  id: string
  name: string
  is_builtin: boolean
  is_remote: false
  remote_version: null
  created_at: number
  updated_at: number
}

interface AnalyticsWord {
  id: string
  vocabulary_id: string
  kk: string
  ru: string
  level: 'A1' | 'A2'
  created_at: number
}

interface AnalyticsWordProgress {
  uuid: string
  word_id: string
  vocabulary_id: string
  repetition: number
  interval: number
  ease_factor: number
  next_review: number
  last_reviewed_at: number | null
  first_seen_at: null
  mastered: boolean
}

interface AnalyticsVocabularyProgress {
  uuid: string
  vocabulary_id: string
  total: number
  mastered: number
  in_progress: number
  new: number
  completion: number
  snapshotted_at: number
}

interface AnalyticsEvent {
  id: string
  uuid: string
  vocabulary_id: string
  word_id: string
  event_type: StatsEventType
  correct: boolean | null
  response_ms: number | null
  ts: number
}

interface AnalyticsWordRef {
  vocabularyId: string
  wordId: string
}

interface AnalyticsEventsRequest {
  vocabularies: AnalyticsVocabulary[]
  words: AnalyticsWord[]
  events: AnalyticsEvent[]
}

interface AnalyticsSnapshotRequest {
  vocabularies: AnalyticsVocabulary[]
  words: AnalyticsWord[]
  word_progress: AnalyticsWordProgress[]
  vocabulary_progress: AnalyticsVocabularyProgress[]
}

type AnalyticsRequestBody = {
  '/api/events': AnalyticsEventsRequest
  '/api/snapshot': AnalyticsSnapshotRequest
}

function log(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`${LOG_PREFIX} ${message}`, details)
    return
  }

  console.log(`${LOG_PREFIX} ${message}`)
}

function logError(
  message: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  console.warn(`${LOG_PREFIX} ${message}`, {
    ...details,
    error: error instanceof Error ? error.message : String(error),
  })
}

interface StatsStorage {
  statsClientUuid?: string
  statsPendingEvents?: AnalyticsEvent[]
  statsPendingSnapshots?: AnalyticsSnapshotRequest[]
  statsLastSnapshotDate?: string
}

export function syncStatsInBackground(storage: StorageShape) {
  if (!storage.settings.analyticsEnabled) {
    log('background stats maintenance skipped: analytics disabled')
    return
  }

  log('background stats maintenance scheduled; queue only, no immediate send', {
    vocabularies: storage.vocabularies.length,
    words: storage.vocabularies.reduce(
      (total, vocabulary) => total + vocabulary.words.length,
      0,
    ),
  })
  void recordDailySnapshot(storage)
}

export function flushStatsQueueFromTimer(storage: StorageShape) {
  if (!storage.settings.analyticsEnabled) {
    log('timer queue drain skipped: analytics disabled')
    return
  }

  log('timer requested queue drain')
  void flushStats(storage)
}

export async function recordChallengeEvent(
  storage: StorageShape,
  result: ChallengeResult,
) {
  if (!storage.settings.analyticsEnabled) {
    log('challenge event skipped: analytics disabled', {
      wordId: result.wordId,
      source: result.source,
    })
    return
  }

  const vocabulary = storage.vocabularies.find((candidate) =>
    candidate.words.some((word) => word.id === result.wordId),
  )
  const word = vocabulary?.words.find(
    (candidate) => candidate.id === result.wordId,
  )

  if (!vocabulary || !word) {
    log('challenge event skipped: word/vocabulary not found', {
      wordId: result.wordId,
      source: result.source,
    })
    return
  }

  log('challenge event captured', {
    vocabularyId: vocabulary.id,
    wordId: word.id,
    wasSkipped: result.wasSkipped,
    wasCorrect: result.wasCorrect,
    elapsedMs: result.elapsedMs,
  })

  await enqueueEvent(storage, {
    ...toAnalyticsWordRef(vocabulary, word.id),
    eventType: result.wasSkipped ? 'skipped' : 'answered',
    correct: result.wasSkipped ? null : result.wasCorrect,
    responseMs: result.elapsedMs,
  })
}

export async function recordSettingsEvent(
  storage: StorageShape,
  eventType: Extract<StatsEventType, 'disabled' | 'enabled'>,
) {
  if (!storage.settings.analyticsEnabled) {
    log('settings event skipped: analytics disabled', { eventType })
    return
  }

  const vocabulary = storage.vocabularies.find(
    (candidate) => candidate.words.length > 0,
  )
  const word = vocabulary?.words[0]
  if (!vocabulary || !word) {
    log('settings event skipped: no vocabulary/word anchor', { eventType })
    return
  }

  log('settings event captured', {
    eventType,
    vocabularyId: vocabulary.id,
    wordId: word.id,
  })

  await enqueueEvent(storage, {
    ...toAnalyticsWordRef(vocabulary, word.id),
    eventType,
    correct: null,
    responseMs: null,
  })
}

async function enqueueEvent(
  _storage: StorageShape,
  input: {
    vocabularyId: string
    wordId: string
    eventType: StatsEventType
    correct: boolean | null
    responseMs: number | null
  },
) {
  const uuid = await getClientUuid()
  const event: AnalyticsEvent = {
    id: crypto.randomUUID(),
    uuid,
    vocabulary_id: input.vocabularyId,
    word_id: input.wordId,
    event_type: input.eventType,
    correct: input.correct,
    response_ms: input.responseMs,
    ts: Date.now(),
  }

  const queued = await getPendingEvents()
  const nextQueue = [...queued, event].slice(-MAX_QUEUED_EVENTS)
  await chrome.storage.local.set({
    [PENDING_EVENTS_KEY]: nextQueue,
  })
  log('event queued locally; waiting for timer to send', {
    eventId: event.id,
    eventType: event.event_type,
    queueBefore: queued.length,
    queueAfter: nextQueue.length,
  })
}

async function recordDailySnapshot(storage: StorageShape) {
  const today = new Date().toISOString().slice(0, 10)
  const current = (await chrome.storage.local.get([
    LAST_SNAPSHOT_DATE_KEY,
  ])) as StatsStorage

  if (current.statsLastSnapshotDate === today) {
    log('daily snapshot skipped: already queued today', { today })
    return
  }

  const snapshot = await buildSnapshot(storage)
  const queued = await getPendingSnapshots()
  const nextQueue = [...queued, snapshot].slice(-MAX_QUEUED_SNAPSHOTS)
  await chrome.storage.local.set({
    [LAST_SNAPSHOT_DATE_KEY]: today,
    [PENDING_SNAPSHOTS_KEY]: nextQueue,
  })
  log('daily snapshot queued locally; waiting for timer to send', {
    today,
    queueBefore: queued.length,
    queueAfter: nextQueue.length,
    wordProgress: snapshot.word_progress.length,
    vocabularyProgress: snapshot.vocabulary_progress.length,
  })
}

async function flushStats(storage: StorageShape) {
  if (flushInFlight) {
    flushRequestedAgain = true
    log('flush skipped: already in flight; retry requested')
    return
  }

  flushInFlight = true
  log('flush started')
  try {
    const snapshots = await getPendingSnapshots()
    log('snapshot queue loaded', { count: snapshots.length })
    for (const snapshot of snapshots) {
      try {
        log('sending snapshot request', {
          wordProgress: snapshot.word_progress.length,
          vocabularyProgress: snapshot.vocabulary_progress.length,
        })
        await postJson('/api/snapshot', snapshot)
        const latest = await getPendingSnapshots()
        await chrome.storage.local.set({
          [PENDING_SNAPSHOTS_KEY]: latest.slice(1),
        })
        log('snapshot request succeeded', {
          remaining: Math.max(0, latest.length - 1),
        })
      } catch (error) {
        logError('snapshot request failed; keeping queued', error)
        return
      }
    }

    const events = await getPendingEvents()
    log('event queue loaded', { count: events.length })
    if (events.length === 0) {
      log('flush finished: no events queued')
      return
    }

    const vocabularies = mapVocabularies(storage.vocabularies)
    const words = mapWords(storage.vocabularies)
    for (
      let offset = 0;
      offset < events.length;
      offset += MAX_EVENT_BATCH_SIZE
    ) {
      const batch = events.slice(offset, offset + MAX_EVENT_BATCH_SIZE)
      try {
        log('sending events request', {
          batchSize: batch.length,
          totalQueuedAtStart: events.length,
          firstEventId: batch[0]?.id,
          lastEventId: batch.at(-1)?.id,
        })
        await postJson('/api/events', { vocabularies, words, events: batch })
        const latest = await getPendingEvents()
        await chrome.storage.local.set({
          [PENDING_EVENTS_KEY]: latest.slice(
            Math.min(batch.length, latest.length),
          ),
        })
        log('events request succeeded', {
          sent: batch.length,
          remaining: Math.max(0, latest.length - batch.length),
        })
      } catch (error) {
        logError('events request failed; keeping queued', error, {
          batchSize: batch.length,
          firstEventId: batch[0]?.id,
          lastEventId: batch.at(-1)?.id,
        })
        return
      }
    }

    log('flush finished')
  } catch (error) {
    logError('flush failed before request completed', error)
  } finally {
    flushInFlight = false
    if (flushRequestedAgain) {
      flushRequestedAgain = false
      log('flush retry started after in-flight flush completed')
      void flushStats(storage)
    }
  }
}

async function buildSnapshot(
  storage: StorageShape,
): Promise<AnalyticsSnapshotRequest> {
  return {
    vocabularies: mapVocabularies(storage.vocabularies),
    words: mapWords(storage.vocabularies),
    word_progress: await mapWordProgress(storage.vocabularies),
    vocabulary_progress: await mapVocabularyProgress(storage.vocabularies),
  }
}

async function getClientUuid() {
  const current = (await chrome.storage.local.get([
    CLIENT_UUID_KEY,
  ])) as StatsStorage
  if (current.statsClientUuid) return current.statsClientUuid

  const uuid = crypto.randomUUID()
  await chrome.storage.local.set({ [CLIENT_UUID_KEY]: uuid })
  return uuid
}

async function getPendingEvents() {
  const current = (await chrome.storage.local.get([
    PENDING_EVENTS_KEY,
  ])) as StatsStorage
  return Array.isArray(current.statsPendingEvents)
    ? current.statsPendingEvents
    : []
}

async function getPendingSnapshots() {
  const current = (await chrome.storage.local.get([
    PENDING_SNAPSHOTS_KEY,
  ])) as StatsStorage
  return Array.isArray(current.statsPendingSnapshots)
    ? current.statsPendingSnapshots
    : []
}

// The only analytics network sender. It accepts only the two documented
// endpoint/body pairs above and never receives page URLs or page content.
async function postJson<TPath extends AnalyticsEndpoint>(
  path: TPath,
  body: AnalyticsRequestBody[TPath],
) {
  log('request started', { method: 'POST', url: `${STATS_BASE_URL}${path}` })
  const response = await fetch(`${STATS_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  log('response received', {
    method: 'POST',
    url: `${STATS_BASE_URL}${path}`,
    status: response.status,
    ok: response.ok,
  })
  if (!response.ok) throw new Error(`Stats request failed: ${response.status}`)
}

function mapVocabularies(vocabularies: Vocabulary[]): AnalyticsVocabulary[] {
  return vocabularies
    .filter((vocabulary) => vocabulary.isBuiltin)
    .map((vocabulary) => ({
      id: vocabulary.id,
      name: vocabulary.name,
      is_builtin: true,
      is_remote: false,
      remote_version: null,
      created_at: vocabulary.createdAt,
      updated_at: vocabulary.updatedAt,
    }))
}

function mapWords(vocabularies: Vocabulary[]): AnalyticsWord[] {
  return vocabularies.flatMap((vocabulary) =>
    vocabulary.isBuiltin
      ? vocabulary.words.map((word) => ({
          id: word.id,
          vocabulary_id: vocabulary.id,
          kk: word.sourceText,
          ru: word.targetText,
          level: word.level,
          created_at: vocabulary.createdAt,
        }))
      : [],
  )
}

async function mapWordProgress(
  vocabularies: Vocabulary[],
): Promise<AnalyticsWordProgress[]> {
  const uuid = await getClientUuid()
  return vocabularies.flatMap((vocabulary) =>
    vocabulary.isBuiltin
      ? vocabulary.words.map((word) => ({
          uuid,
          word_id: word.id,
          vocabulary_id: vocabulary.id,
          repetition: word.srs.repetition,
          interval: word.srs.interval,
          ease_factor: word.srs.easeFactor,
          next_review: word.srs.nextReview,
          last_reviewed_at: word.srs.lastReviewedAt ?? null,
          first_seen_at: null,
          mastered: word.srs.repetition >= 3 && word.srs.interval > 7,
        }))
      : [],
  )
}

async function mapVocabularyProgress(
  vocabularies: Vocabulary[],
): Promise<AnalyticsVocabularyProgress[]> {
  const uuid = await getClientUuid()
  const snapshottedAt = Date.now()
  return vocabularies.map((vocabulary) => {
    const vocabularyId = vocabulary.isBuiltin ? vocabulary.id : 'custom'
    const total = vocabulary.words.length
    const mastered = vocabulary.words.filter(
      (word) => word.srs.repetition >= 3 && word.srs.interval > 7,
    ).length
    const inProgress = vocabulary.words.filter(
      (word) =>
        word.srs.lastReviewedAt &&
        !(word.srs.repetition >= 3 && word.srs.interval > 7),
    ).length

    return {
      uuid,
      vocabulary_id: vocabularyId,
      total,
      mastered,
      in_progress: inProgress,
      new: Math.max(0, total - mastered - inProgress),
      completion: total === 0 ? 0 : Math.round((mastered / total) * 100),
      snapshotted_at: snapshottedAt,
    }
  })
}

function toAnalyticsWordRef(
  vocabulary: Vocabulary,
  wordId: string,
): AnalyticsWordRef {
  if (vocabulary.isBuiltin) {
    return {
      vocabularyId: vocabulary.id,
      wordId,
    }
  }

  return {
    vocabularyId: 'custom',
    wordId: 'custom',
  }
}
