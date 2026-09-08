import type { RemoteVocabularyCatalog } from './api-contract'
import { assertProtocol } from './protocol/validate'
import type { StorageShape, Vocabulary } from './types'
import { isVocabulary } from './validation'

export const PUBLIC_VOCABULARY_IDS = [
  'builtin-kazakh-basic-words',
  'builtin-kazakh-everyday-words',
  'builtin-kazakh-expanded-words',
] as const

export function migrateRemoteVocabularies(
  current: Vocabulary[],
  archive: Vocabulary[],
  connected: boolean,
) {
  const vocabularies: Vocabulary[] = []
  const remoteArchive = Array.isArray(archive)
    ? archive.filter(isVocabulary)
    : []
  for (const existing of current) {
    const vocabulary = existing.isBuiltin
      ? {
          ...existing,
          isRemote: true,
          requiresOrganization:
            existing.requiresOrganization ??
            !PUBLIC_VOCABULARY_IDS.some((id) => id === existing.id),
        }
      : existing
    if (vocabulary.requiresOrganization && !connected) {
      const index = remoteArchive.findIndex((item) => item.id === vocabulary.id)
      if (index >= 0) remoteArchive[index] = vocabulary
      else remoteArchive.push(vocabulary)
    } else vocabularies.push(vocabulary)
  }
  return { vocabularies, remoteArchive }
}

/** Pure merge: validation completes before any storage can be changed. */
export function mergeRemoteCatalog(
  storage: StorageShape,
  input: unknown,
): StorageShape {
  assertProtocol('RemoteVocabularyCatalog', input)
  const catalog = input as RemoteVocabularyCatalog
  const ids = new Set<string>()
  for (const vocabulary of catalog.vocabularies) {
    if (
      ids.has(vocabulary.id) ||
      new Set(vocabulary.words.map((word) => word.id)).size !==
        vocabulary.words.length
    )
      throw new Error('Duplicate catalog identity')
    ids.add(vocabulary.id)
  }
  const custom = storage.vocabularies.filter(
    (item) => !item.isBuiltin && !item.isRemote,
  )
  if (custom.some((item) => ids.has(item.id)))
    throw new Error('Catalog identity conflict')
  const previous = new Map(
    [
      ...storage.remoteArchive,
      ...storage.vocabularies.filter((item) => item.isRemote || item.isBuiltin),
    ].map((item) => [item.id, item]),
  )
  const remote = catalog.vocabularies.map((item): Vocabulary => {
    const old = previous.get(item.id)
    const words = new Map(old?.words.map((word) => [word.id, word]))
    return {
      id: item.id,
      name: item.name,
      ...(item.description !== undefined
        ? { description: item.description }
        : {}),
      category: old?.category ?? 'mixed',
      isBuiltin: true,
      isRemote: true,
      remoteVersion: item.version,
      requiresOrganization: item.requiresOrganization,
      createdAt: old?.createdAt ?? item.updatedAt,
      updatedAt: item.updatedAt,
      words: item.words.map((word) => ({
        id: word.id,
        sourceText: word.kk,
        targetText: word.ru,
        sourceLabel: 'qazaq tili',
        targetLabel: 'orys tili',
        level: word.level,
        srs: words.get(word.id)?.srs ?? {
          repetition: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReview: 0,
        },
      })),
    }
  })
  const vocabularies = [
    ...remote.filter(
      (item) => !item.requiresOrganization || storage.organization,
    ),
    ...custom,
  ]
  const visibleIds = new Set(vocabularies.map((item) => item.id))
  const remoteArchive = [...previous.values()].filter(
    (item) => !visibleIds.has(item.id),
  )
  for (const item of remote.filter((item) => !visibleIds.has(item.id))) {
    const index = remoteArchive.findIndex((old) => old.id === item.id)
    if (index >= 0) remoteArchive[index] = item
    else remoteArchive.push(item)
  }
  const active = storage.activeVocabularyIds.filter((id) => visibleIds.has(id))
  if (active.length === 0 && vocabularies[0]) active.push(vocabularies[0].id)
  return {
    ...storage,
    vocabularies,
    remoteArchive,
    catalogVersion: catalog.version,
    activeVocabularyIds: active,
    activeVocabularyId: active[0] ?? '',
  }
}
