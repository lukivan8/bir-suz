import { test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  connectOrganization,
  requestOrganization,
} from '../src/shared/organization'
import fixtures from '../src/shared/protocol/fixtures.json'
import { normalizeStorage } from '../src/shared/storage'

const uuid = '00000000-0000-4000-8000-000000000001'
const transport = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch

test('connect response and distinct safe errors follow contract', async () => {
  assert.deepEqual(
    await requestOrganization(
      uuid,
      ' TEST ',
      transport(fixtures['connect-success'][1]),
    ),
    fixtures['connect-success'][1],
  )
  await assert.rejects(
    requestOrganization(
      uuid,
      'TEST',
      transport(fixtures['code-unknown'][1], 404),
    ),
    /не найден/,
  )
  await assert.rejects(
    requestOrganization(
      uuid,
      'TEST',
      transport(fixtures['code-disabled'][1], 400),
    ),
    /не активна/,
  )
  await assert.rejects(
    requestOrganization(uuid, 'TEST', (async () => {
      throw new Error('private details')
    }) as typeof fetch),
    /Нет связи/,
  )
  await assert.rejects(
    requestOrganization(uuid, 'TEST', transport({}, 500)),
    /Повторите позже/,
  )
  await assert.rejects(
    requestOrganization(uuid, 'TEST', transport({})),
    /Некорректный ответ/,
  )
})

test('operational connect persists without analytics, retries are idempotent and cannot switch', async () => {
  let stored: Record<string, unknown> = {
    ...normalizeStorage({}),
    statsClientUuid: uuid,
  }
  let connects = 0
  const originalFetch = globalThis.fetch
  const originals = ['chrome', 'navigator'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  )
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      storage: {
        local: {
          get: async () => structuredClone(stored),
          set: async (patch: Record<string, unknown>) => {
            stored = { ...stored, ...patch }
          },
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: async (_name: string, run: () => Promise<unknown>) => run(),
      },
    },
  })
  globalThis.fetch = (async (input) => {
    if (String(input).endsWith('/organization/connect')) {
      connects++
      return new Response(JSON.stringify(fixtures['connect-success'][1]))
    }
    return new Response(JSON.stringify(fixtures['catalog-organization'][1]), {
      headers: { ETag: '"synthetic"' },
    })
  }) as typeof fetch
  try {
    const code = fixtures['connect-success'][1].organization.code
    assert.deepEqual(await connectOrganization(` ${code.toLowerCase()} `), {
      ok: true,
    })
    assert.equal((stored.vocabularies as unknown[]).length, 4)
    assert.equal(
      (stored.settings as { analyticsEnabled: boolean }).analyticsEnabled,
      false,
    )
    assert.deepEqual(
      stored.organization,
      fixtures['connect-success'][1].organization,
    )
    assert.deepEqual(await connectOrganization(code), { ok: true })
    assert.equal(connects, 1)
    assert.equal((await connectOrganization('DIFFERENT')).ok, false)
    assert.ok(!('statsPendingEvents' in stored))
    // A successful public catalog after archival hides access, retaining history.
    const { mergeRemoteCatalog } = await import('../src/shared/remote-model')
    const after = mergeRemoteCatalog(
      normalizeStorage(stored),
      fixtures['catalog-public'][1],
    )
    assert.equal(after.vocabularies.length, 3)
    assert.equal(after.remoteArchive.length, 1)
    assert.deepEqual(after.organization, stored.organization)
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
