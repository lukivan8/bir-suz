import { type CatalogResponse, fetchCatalog } from './api-client'
import { mergeRemoteCatalog } from './remote-model'
import { getStorage, updateStorage, withStorageLock } from './storage'
import type { StorageShape } from './types'

export type SyncStatus = 'updated' | 'unchanged' | 'error'

export function createCatalogSync(deps: {
  read: () => Promise<StorageShape>
  write: (patch: Partial<StorageShape>) => Promise<void>
  request: (
    code: string | undefined,
    etag: string | null,
  ) => Promise<CatalogResponse>
  lock: <T>(run: () => Promise<T>) => Promise<T>
}) {
  let flight: Promise<SyncStatus> | undefined
  async function run(): Promise<SyncStatus> {
    try {
      // A connection can change while HTTP is in flight. Never commit a response
      // fetched with a previous access context; fetch the new context instead.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const before = await deps.read()
        const code = before.organization?.code
        const response = await deps.request(code, before.catalogEtag)
        const result = await deps.lock(async () => {
          const current = await deps.read()
          if (current.organization?.code !== code) return 'retry' as const
          if (response.status === 304) {
            if (current.catalogVersion === null)
              throw new Error('No cached catalog')
            return 'unchanged' as const
          }
          const merged = mergeRemoteCatalog(current, response.catalog)
          await deps.write({
            vocabularies: merged.vocabularies,
            remoteArchive: merged.remoteArchive,
            activeVocabularyId: merged.activeVocabularyId,
            activeVocabularyIds: merged.activeVocabularyIds,
            catalogVersion: merged.catalogVersion,
            catalogEtag: response.etag,
            lastSyncAt: Date.now(),
          })
          return 'updated' as const
        })
        if (result !== 'retry') return result
      }
    } catch {
      // Deliberately omit exceptions: network errors can contain request details.
    }
    return 'error'
  }
  return () => {
    if (!flight)
      flight = run().finally(() => {
        flight = undefined
      })
    return flight
  }
}

export const syncCatalog = createCatalogSync({
  read: getStorage,
  write: updateStorage,
  request: fetchCatalog,
  lock: withStorageLock,
})
