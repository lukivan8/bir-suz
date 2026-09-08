import { test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  ensureStorage,
  getStorage,
  normalizeStorage,
  withStorageLock,
} from '../src/shared/storage'

test('migration and catalog writes share a lock; ordinary reads never write stale normalization', async () => {
  let stored: Record<string, unknown> = {}
  let release: () => void = () => {}
  const delayedRead = new Promise<void>((resolve) => {
    release = resolve
  })
  let first = true
  let entered: () => void = () => {}
  const reading = new Promise<void>((resolve) => {
    entered = resolve
  })
  let tail = Promise.resolve()
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  )
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: (_name: string, run: () => Promise<void>) => {
          const next = tail.then(run)
          tail = next.catch(() => {})
          return next
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      storage: {
        local: {
          get: async () => {
            const snapshot = structuredClone(stored)
            if (first) {
              first = false
              entered()
              await delayedRead
            }
            return snapshot
          },
          set: async (patch: Record<string, unknown>) => {
            stored = { ...stored, ...patch }
          },
        },
      },
    },
  })
  try {
    const migration = ensureStorage()
    await reading
    const update = withStorageLock(async () => {
      stored = { ...stored, catalogVersion: 12 }
    })
    release()
    await Promise.all([migration, update])
    assert.equal(stored.catalogVersion, 12)
    const before = structuredClone(stored)
    assert.deepEqual(await getStorage(), normalizeStorage(stored))
    assert.deepEqual(stored, before)
  } finally {
    if (originalChrome)
      Object.defineProperty(globalThis, 'chrome', originalChrome)
    else Reflect.deleteProperty(globalThis, 'chrome')
    if (originalNavigator)
      Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
  }
})
