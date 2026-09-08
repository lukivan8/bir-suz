import { analyticsAllowed } from './analytics-consent'
import { transitionEvents } from './analytics-events'
import { API_ORIGIN } from './api-client'
import type { AnalyticsBatchResponse, AnalyticsEventV2 } from './api-contract'
import { validateProtocol } from './protocol/validate'
import {
  ensureStorage,
  getStorage,
  updateStorage,
  withStorageLock,
} from './storage'
import type { ChallengeResult, StorageShape } from './types'

export type StatsEventType = 'answered' | 'skipped' | 'disabled' | 'enabled'
const CLIENT_UUID_KEY = 'statsClientUuid'
export async function getClientUuid() {
  return navigator.locks.request('bir-soz-installation-id', async () => {
    const current = await chrome.storage.local.get(CLIENT_UUID_KEY)
    const existing = current[CLIENT_UUID_KEY]
    if (typeof existing === 'string') return existing
    const uuid = crypto.randomUUID()
    await chrome.storage.local.set({ [CLIENT_UUID_KEY]: uuid })
    return uuid
  })
}

/** Caller holds the common storage lock. Queue and local transition commit together. */
export async function persistLearningTransition(
  before: StorageShape,
  after: StorageShape,
  result?: ChallengeResult,
) {
  const inputs = transitionEvents(before, after, result)
  let events: AnalyticsEventV2[] = []
  if (inputs.length) {
    const installationId = await getClientUuid()
    events = inputs
      .map((input) => ({
        ...input,
        id: crypto.randomUUID(),
        installationId,
        occurredAt: Date.now(),
      }))
      .filter((event) =>
        validateProtocol('AnalyticsEventV2', event),
      ) as AnalyticsEventV2[]
  }
  await updateStorage({
    ...after,
    analyticsQueue: analyticsAllowed(after.settings)
      ? [...before.analyticsQueue, ...events]
      : [],
  })
}

// Legacy endpoints remain on the backend. New actions use v2 exclusively; old
// queued legacy payloads are preserved in storage but never replayed as v2 copies.
export function syncStatsInBackground(_state: StorageShape) {}
export async function recordSettingsEvent(
  _state: StorageShape,
  _type: 'disabled' | 'enabled',
) {}
export function flushStatsQueueFromTimer(_state: StorageShape) {
  void flushStats()
}

export function acknowledgedBatch(
  batch: AnalyticsEventV2[],
  response: unknown,
): Set<string> | null {
  if (!validateProtocol('AnalyticsBatchResponse', response)) return null
  const body = response as AnalyticsBatchResponse
  const ids = new Set(batch.map((e) => e.id))
  if (
    body.accepted + body.duplicates + body.rejected.length !== batch.length ||
    body.rejected.some((r) => !ids.has(r.id)) ||
    new Set(body.rejected.map((r) => r.id)).size !== body.rejected.length
  )
    return null
  // Per-event rejections are permanent for this payload. Drop them as well as
  // accepted/duplicate events so one invalid event cannot block later batches.
  return ids
}

export async function flushStats(transport: typeof fetch = fetch) {
  await ensureStorage()
  return navigator.locks.request('bir-soz-analytics-flush', async () => {
    for (;;) {
      let batch: AnalyticsEventV2[] = []
      let request: Promise<Response> | undefined
      const controller = new AbortController()
      const changed = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => {
        if (
          area === 'local' &&
          changes['settings'] &&
          !analyticsAllowed(changes['settings'].newValue ?? {})
        )
          controller.abort()
      }
      chrome.storage.onChanged.addListener(changed)
      try {
        await withStorageLock(async () => {
          const state = await getStorage()
          if (!analyticsAllowed(state.settings)) {
            if (state.analyticsQueue.length)
              await updateStorage({ analyticsQueue: [] })
            return
          }
          const remoteIds = new Set(
            [...state.vocabularies, ...state.remoteArchive]
              .filter((v) => v.isRemote)
              .map((v) => v.id),
          )
          const valid = state.analyticsQueue.filter(
            (event) =>
              validateProtocol('AnalyticsEventV2', event) &&
              (!event.vocabularyId || remoteIds.has(event.vocabularyId)),
          )
          if (valid.length !== state.analyticsQueue.length)
            await updateStorage({ analyticsQueue: valid })
          batch = valid.slice(0, 50)
          if (!batch.length) return
          request = transport(`${API_ORIGIN}/api/v1/analytics/events/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'omit',
            body: JSON.stringify({ events: batch }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          })
        })
        if (!request) return
        const response = await request
        if (!response.ok) return
        const ids = acknowledgedBatch(batch, await response.json())
        if (!ids) return
        await withStorageLock(async () => {
          const state = await getStorage()
          await updateStorage({
            analyticsQueue: analyticsAllowed(state.settings)
              ? state.analyticsQueue.filter((e) => !ids.has(e.id))
              : [],
          })
        })
      } catch {
        return
      } finally {
        chrome.storage.onChanged.removeListener(changed)
      }
    }
  })
}
