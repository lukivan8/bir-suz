import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { fetchCatalog } from '../src/shared/api-client'
import { createCatalogSync } from '../src/shared/catalog-sync'
import fixtures from '../src/shared/protocol/fixtures.json'
import { mockCatalog } from '../src/shared/protocol/mock-transport'
import { normalizeStorage } from '../src/shared/storage'
import type { StorageShape } from '../src/shared/types'

function harness() {
  let state = normalizeStorage({})
  let writes = 0
  let requests = 0
  let fail = false
  const request = async (code: string | undefined, etag: string | null) => {
    requests++
    if (fail) throw new Error('synthetic network outage')
    const response = mockCatalog(Boolean(code), etag ?? undefined)
    return response.status === 304
      ? response
      : { status: 200 as const, catalog: response.body, etag: response.etag }
  }
  const sync = createCatalogSync({
    read: async () => structuredClone(state),
    write: async (patch) => {
      writes++
      state = { ...state, ...patch }
    },
    request,
    lock: async (run) => run(),
  })
  return {
    sync,
    state: () => state,
    writes: () => writes,
    requests: () => requests,
    set: (patch: Partial<StorageShape>) => {
      state = { ...state, ...patch }
    },
    fail: () => {
      fail = true
    },
  }
}

test('sync loads public catalog, coalesces concurrency, 304 never writes', async () => {
  const h = harness()
  assert.deepEqual(await Promise.all([h.sync(), h.sync(), h.sync()]), [
    'updated',
    'updated',
    'updated',
  ])
  assert.equal(h.requests(), 1)
  assert.equal(h.state().vocabularies.length, 3)
  const snapshot = structuredClone(h.state())
  assert.equal(await h.sync(), 'unchanged')
  assert.equal(h.writes(), 1)
  assert.deepEqual(h.state(), snapshot)
  h.fail()
  assert.equal(await h.sync(), 'error')
  assert.deepEqual(h.state(), snapshot)
})

test('connect updates catalog and failed cold fetch leaves empty state', async () => {
  const cold = harness()
  cold.fail()
  assert.equal(await cold.sync(), 'error')
  assert.equal(cold.state().vocabularies.length, 0)
  const h = harness()
  await h.sync()
  h.set({ organization: fixtures['connect-success'][1].organization })
  await h.sync()
  assert.equal(h.state().vocabularies.length, 4)
})

test('access changes during HTTP discard stale response; fresh SRS and custom content survive', async () => {
  let state = normalizeStorage({})
  let requests = 0
  const sync = createCatalogSync({
    read: async () => structuredClone(state),
    write: async (patch) => {
      state = { ...state, ...patch }
    },
    lock: async (run) => run(),
    request: async (code) => {
      requests++
      if (requests === 1)
        state.organization = fixtures['connect-success'][1].organization
      const response = mockCatalog(Boolean(code))
      assert.equal(response.status, 200)
      if (response.status !== 200) throw new Error('fixture')
      return { status: 200, catalog: response.body, etag: response.etag }
    },
  })
  assert.equal(await sync(), 'updated')
  assert.equal(requests, 2)
  assert.equal(state.vocabularies.length, 4)
})

test('HTTP client validates JSON and preserves 304 without reading body', async () => {
  let headers: HeadersInit | undefined
  const response = mockCatalog()
  assert.equal(response.status, 200)
  if (response.status !== 200) throw new Error('fixture')
  const transport = (async (_url, init) => {
    headers = init?.headers
    return new Response(JSON.stringify(response.body), {
      headers: { ETag: response.etag },
    })
  }) as typeof fetch
  assert.equal(
    (await fetchCatalog('SYNTHETIC', response.etag, transport)).status,
    200,
  )
  assert.equal(new Headers(headers).get('X-Bir-Organization-Code'), 'SYNTHETIC')
  assert.equal(new Headers(headers).get('If-None-Match'), response.etag)
  const notModified = (async () =>
    new Response(null, { status: 304 })) as typeof fetch
  assert.deepEqual(await fetchCatalog(undefined, null, notModified), {
    status: 304,
  })
  for (const value of ['bad JSON', '{"protocolVersion":2}']) {
    await assert.rejects(
      fetchCatalog(
        undefined,
        null,
        (async () => new Response(value)) as typeof fetch,
      ),
    )
  }
})

test('response merges latest SRS and custom dictionary written while fetch was pending', async () => {
  const h = harness()
  await h.sync()
  let state = h.state()
  const sync = createCatalogSync({
    read: async () => structuredClone(state),
    write: async (patch) => {
      state = { ...state, ...patch }
    },
    lock: async (run) => run(),
    request: async () => {
      state.vocabularies[0].words[0].srs.repetition = 8
      state.vocabularies.push({
        ...structuredClone(state.vocabularies[0]),
        id: 'private-during-fetch',
        isBuiltin: false,
        isRemote: false,
      })
      state.activeVocabularyIds = ['private-during-fetch']
      state.activeVocabularyId = 'private-during-fetch'
      const response = mockCatalog()
      if (response.status !== 200) throw new Error('fixture')
      return { status: 200, etag: response.etag, catalog: response.body }
    },
  })
  await sync()
  assert.equal(state.vocabularies[0].words[0].srs.repetition, 8)
  assert.equal(state.vocabularies.at(-1).id, 'private-during-fetch')
  assert.deepEqual(state.activeVocabularyIds, ['private-during-fetch'])
})
