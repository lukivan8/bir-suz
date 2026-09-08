import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { ANALYTICS_CONSENT_VERSION } from '../src/shared/analytics-consent'
import { transitionEvents } from '../src/shared/analytics-events'
import fixtures from '../src/shared/protocol/fixtures.json'
import { mergeRemoteCatalog } from '../src/shared/remote-model'
import {
  acknowledgedBatch,
  flushStats,
  persistLearningTransition,
} from '../src/shared/stats'
import {
  ensureStorage,
  getStorage,
  normalizeStorage,
  updateStorage,
  withStorageLock,
} from '../src/shared/storage'
import {
  flipStudyCard,
  rateStudyCard,
  showStudyCard,
  startStudy,
} from '../src/shared/study'
import type { ChallengeResult, StorageShape } from '../src/shared/types'

function state() {
  const s = mergeRemoteCatalog(
    normalizeStorage({}),
    fixtures['catalog-public'][1],
  )
  s.settings.analyticsEnabled = true
  s.settings.analyticsConsentVersion = ANALYTICS_CONSENT_VERSION
  return s
}
function result(s: StorageShape, duration = 120001): ChallengeResult {
  return {
    vocabularyId: s.vocabularies[0].id,
    wordId: s.vocabularies[0].words[0].id,
    elapsedMs: duration,
    source: 'navigation',
    wasCorrect: true,
    wasSkipped: false,
    timedOut: false,
  }
}
test('payload allowlist preserves raw120000/120001/long timing and excludes private dictionaries', () => {
  const s = state()
  for (const duration of [120000, 120001, 9999999]) {
    assert.deepEqual(transitionEvents(s, s, result(s, duration)), [
      {
        type: 'challenge_completed',
        vocabularyId: s.vocabularies[0].id,
        wordId: s.vocabularies[0].words[0].id,
        correct: true,
        durationMs: duration,
      },
    ])
    let card = startStudy(s)
    const started = transitionEvents(s, card)
    assert.ok(started.every((e) => e.durationMs === undefined))
    card = showStudyCard(card, card.studySession.id, 0, 0)
    card = flipStudyCard(card, card.studySession.id, 0)
    const rated = rateStudyCard(card, card.studySession.id, 0, 2, duration)
    const events = transitionEvents(card, rated)
    assert.equal(
      events.find((e) => e.type === 'study_card_rated')?.durationMs,
      duration,
    )
    assert.ok(
      events
        .filter((e) => e.type === 'study_session_completed')
        .every((e) => e.durationMs === undefined),
    )
  }
  assert.equal(
    transitionEvents(s, s, { ...result(s), wasSkipped: true })[0].durationMs,
    undefined,
  )
  s.vocabularies[0].isRemote = false
  s.vocabularies[0].id = 'private-vocabulary'
  assert.deepEqual(transitionEvents(s, s, result(s)), [])
  const cards = startStudy(s)
  assert.deepEqual(transitionEvents(s, cards), [])
  s.settings.analyticsEnabled = false
  assert.deepEqual(
    transitionEvents(
      s,
      {
        ...s,
        onboarding: { version: 1, runId: 'new', steps: {}, browserAnswers: 0 },
      },
      result(s),
    ),
    [],
  )
})

async function harness(run: () => Promise<void>, initial = state()) {
  let data: Record<string, unknown> = {
    ...initial,
    statsClientUuid: '00000000-0000-4000-8000-000000000001',
  }
  const listeners = new Set<(changes: unknown, area: string) => void>()
  const locks = new Map<string, Promise<unknown>>()
  const originals = ['chrome', 'navigator'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  )
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      storage: {
        local: {
          get: async () => structuredClone(data),
          set: async (patch: Record<string, unknown>) => {
            const changes = Object.fromEntries(
              Object.entries(patch).map(([k, v]) => [
                k,
                { oldValue: data[k], newValue: v },
              ]),
            )
            data = { ...data, ...structuredClone(patch) }
            listeners.forEach((l) => {
              l(changes, 'local')
            })
          },
        },
        onChanged: {
          addListener: (l: typeof listeners extends Set<infer L> ? L : never) =>
            listeners.add(l),
          removeListener: (
            l: typeof listeners extends Set<infer L> ? L : never,
          ) => listeners.delete(l),
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: (name: string, fn: () => Promise<unknown>) => {
          const next = (locks.get(name) ?? Promise.resolve()).then(fn)
          locks.set(
            name,
            next.catch(() => {}),
          )
          return next
        },
      },
    },
  })
  try {
    await run()
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}
async function enqueue(duration = 100) {
  await withStorageLock(async () => {
    const s = await getStorage()
    await persistLearningTransition(s, s, result(s, duration))
  })
}

test('durable queue survives offline, keeps IDs across retry, drains partial rejections without losing new events', async () =>
  harness(async () => {
    await enqueue(120001)
    const initial = await getStorage()
    await flushStats((async () => {
      throw new Error('offline')
    }) as typeof fetch)
    assert.deepEqual(
      (await getStorage()).analyticsQueue,
      initial.analyticsQueue,
    )
    let release: (r: Response) => void = () => {}
    let began: () => void = () => {}
    const started = new Promise<void>((r) => {
      began = r
    })
    const sent: string[][] = []
    const draining = flushStats((async (_url, init) => {
      const batch = JSON.parse(String(init?.body)).events
      sent.push(batch.map((e: { id: string }) => e.id))
      if (sent.length === 1) {
        began()
        return new Promise<Response>((r) => {
          release = r
        })
      }
      return new Response(
        JSON.stringify({ accepted: 0, duplicates: batch.length, rejected: [] }),
      )
    }) as typeof fetch)
    await started
    await enqueue(55)
    release(
      new Response(
        JSON.stringify({
          accepted: 0,
          duplicates: 0,
          rejected: [
            { id: initial.analyticsQueue[0].id, code: 'INVALID_REQUEST' },
          ],
        }),
      ),
    )
    await draining
    assert.equal(sent.length, 2)
    assert.equal(sent[0][0], initial.analyticsQueue[0].id)
    assert.notEqual(sent[1][0], sent[0][0])
    assert.equal((await getStorage()).analyticsQueue.length, 0)
    assert.equal(
      acknowledgedBatch(initial.analyticsQueue, {
        accepted: 0,
        duplicates: 0,
        rejected: [],
      }),
      null,
    )
  }))

test('opt-out creates no events, clears pending data and aborts in-flight delivery', async () =>
  harness(async () => {
    await enqueue()
    let began: () => void = () => {}
    const started = new Promise<void>((r) => {
      began = r
    })
    let aborted = false
    const draining = flushStats((async (_url, init) => {
      began()
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true
          reject(new Error('aborted'))
        })
      })
    }) as typeof fetch)
    await started
    await withStorageLock(async () => {
      const s = await getStorage()
      await persistLearningTransition(s, {
        ...s,
        settings: { ...s.settings, analyticsEnabled: false },
      })
    })
    await draining
    assert.equal(aborted, true)
    await enqueue()
    assert.equal((await getStorage()).analyticsQueue.length, 0)
    let sent = false
    await flushStats((async () => {
      sent = true
      return new Response()
    }) as typeof fetch)
    assert.equal(sent, false)
  }))

test('poisoned queue entry cannot send forbidden fields or block valid events', async () =>
  harness(async () => {
    await enqueue()
    const s = await getStorage()
    await updateStorage({
      analyticsQueue: [
        {
          ...s.analyticsQueue[0],
          id: 'poison',
          pageContent: 'private',
        } as never,
        ...s.analyticsQueue,
      ],
    })
    let count = 0
    await flushStats((async (_url, init) => {
      const batch = JSON.parse(String(init?.body)).events
      count += batch.length
      assert.ok(!String(init?.body).includes('private'))
      return new Response(
        JSON.stringify({ accepted: batch.length, duplicates: 0, rejected: [] }),
      )
    }) as typeof fetch)
    assert.equal(count, 1)
    assert.equal((await getStorage()).analyticsQueue.length, 0)
  }))

test('onboarding and organization events carry IDs but never code or content', () => {
  const before = state()
  const after = {
    ...before,
    organization: {
      id: 'synthetic-org',
      name: 'Private name',
      code: 'PRIVATE-CODE',
    },
    onboarding: {
      version: 1 as const,
      runId: 'synthetic-run',
      steps: {
        popup: 'completed' as const,
        vocabulary: 'completed' as const,
        organization: 'skipped' as const,
        browser: 'completed' as const,
      },
      browserAnswers: 3,
      finishedAt: 2000,
    },
  }
  const events = transitionEvents(before, after)
  assert.deepEqual(
    events.map((e) => e.type),
    [
      'onboarding_started',
      'onboarding_step_completed',
      'onboarding_step_completed',
      'onboarding_step_completed',
      'onboarding_step_completed',
      'onboarding_completed',
      'organization_connected',
    ],
  )
  assert.ok(
    events.every(
      (e) => e.organizationId === 'synthetic-org' && e.durationMs === undefined,
    ),
  )
  assert.ok(!JSON.stringify(events).includes('PRIVATE-CODE'))
  assert.ok(!JSON.stringify(events).includes('Private name'))
})

test('old true/false consent fails closed before lifecycle migration and discards queues without touching learning data', async () => {
  for (const enabled of [true, false]) {
    const old = state()
    delete old.settings.analyticsConsentVersion
    old.settings.analyticsEnabled = enabled
    old.userStats.totalCorrect = 17
    old.settings.cooldownMinutes = 7
    old.analyticsQueue = [
      { id: 'old-event', type: 'challenge_completed' },
    ] as never
    await harness(async () => {
      await chrome.storage.local.set({
        statsPendingEvents: [{ old: true }],
        statsPendingSnapshots: [{ old: true }],
      })
      const read = await getStorage()
      assert.equal(read.settings.analyticsEnabled, false)
      assert.deepEqual(transitionEvents(old, old, result(old)), [])
      let requests = 0
      await flushStats((async () => {
        requests++
        return new Response()
      }) as typeof fetch)
      assert.equal(requests, 0)
      const raw = await chrome.storage.local.get(null)
      assert.equal(raw.settings.analyticsEnabled, false)
      assert.deepEqual(raw.analyticsQueue, [])
      assert.deepEqual(raw.statsPendingEvents, [])
      assert.deepEqual(raw.statsPendingSnapshots, [])
      assert.equal(raw.userStats.totalCorrect, 17)
      assert.equal(raw.settings.cooldownMinutes, 7)
      assert.deepEqual(raw.vocabularies, old.vocabularies)
      await enqueue()
      assert.deepEqual((await getStorage()).analyticsQueue, [])
      const pending = await getStorage()
      await updateStorage({
        settings: {
          ...pending.settings,
          analyticsEnabled: true,
          analyticsConsentVersion: ANALYTICS_CONSENT_VERSION,
        },
      })
      assert.deepEqual((await getStorage()).analyticsQueue, [])
      await enqueue()
      assert.equal((await getStorage()).analyticsQueue.length, 1)
    }, old)
  }
})

test('current allow and refusal survive repeated initialization; future consent versions fail closed', async () => {
  for (const enabled of [true, false]) {
    const s = state()
    s.settings.analyticsEnabled = enabled
    await harness(async () => {
      await ensureStorage()
      await ensureStorage()
      assert.equal((await getStorage()).settings.analyticsEnabled, enabled)
      assert.equal(
        (await getStorage()).settings.analyticsConsentVersion,
        ANALYTICS_CONSENT_VERSION,
      )
    }, s)
  }
  const s = state()
  s.settings.analyticsConsentVersion = ANALYTICS_CONSENT_VERSION + 1
  assert.equal(normalizeStorage(s).settings.analyticsEnabled, false)
})
