import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mergeRemoteCatalog } from '../src/shared/remote-model.ts'
import { normalizeStorage } from '../src/shared/storage.ts'
import { normalizeStorageShape } from '../src/shared/validation.ts'

const fixtures = JSON.parse(
  readFileSync(
    new URL('../src/shared/protocol/fixtures.json', import.meta.url),
    'utf8',
  ),
)
const catalog = fixtures['catalog-public'][1]

test('cold offline has no bundled content, valid cache survives restart', () => {
  const cold = normalizeStorage({})
  assert.deepEqual(normalizeStorageShape(cold), cold)
  assert.deepEqual(cold.vocabularies, [])
  assert.deepEqual(cold.activeVocabularyIds, [])
  const loaded = mergeRemoteCatalog(cold, catalog)
  assert.equal(loaded.vocabularies.length, 3)
  assert.deepEqual(normalizeStorage(loaded), loaded)
})

test('migration preserves settings, stats, active choices and custom dictionaries', () => {
  const state = mergeRemoteCatalog(normalizeStorage({}), catalog)
  const custom = {
    ...structuredClone(state.vocabularies[0]),
    id: 'private',
    isBuiltin: false,
    isRemote: false,
  }
  state.vocabularies.push(custom)
  state.activeVocabularyIds = [custom.id]
  state.activeVocabularyId = custom.id
  state.userStats.timeInLanguageContactMs = 12345
  state.settings.cooldownMinutes = 17
  const migrated = normalizeStorage(state)
  assert.deepEqual(migrated, state)
  const merged = mergeRemoteCatalog(migrated, catalog)
  assert.deepEqual(merged.vocabularies.at(-1), custom)
  assert.deepEqual(merged.userStats, state.userStats)
  assert.deepEqual(merged.settings, state.settings)
  assert.deepEqual(merged.activeVocabularyIds, [custom.id])
})

test('stable ID merge updates text and preserves SRS; repeated merge is identical', () => {
  const state = mergeRemoteCatalog(normalizeStorage({}), catalog)
  state.vocabularies[0].words[0].srs.repetition = 4
  const update = structuredClone(catalog)
  update.vocabularies[0].words[0].kk = 'Synthetic update'
  const merged = mergeRemoteCatalog(state, update)
  assert.equal(merged.vocabularies[0].words[0].srs.repetition, 4)
  assert.equal(merged.vocabularies[0].words[0].sourceText, 'Synthetic update')
  assert.deepEqual(mergeRemoteCatalog(merged, update), merged)
})

test('gated content is hidden, archived SRS survives public merge and reconnect', () => {
  const state = normalizeStorage({
    organization: fixtures['connect-success'][1].organization,
  })
  const full = mergeRemoteCatalog(state, fixtures['catalog-organization'][1])
  const gated = full.vocabularies.find((item) => item.requiresOrganization)
  gated.words[0].srs.repetition = 7
  const hidden = normalizeStorage({ ...full, organization: null })
  assert.ok(!hidden.vocabularies.some((item) => item.requiresOrganization))
  assert.equal(hidden.remoteArchive[0].words[0].srs.repetition, 7)
  const publicState = mergeRemoteCatalog(hidden, catalog)
  const restored = mergeRemoteCatalog(
    { ...publicState, organization: state.organization },
    fixtures['catalog-organization'][1],
  )
  assert.equal(
    restored.vocabularies.find((item) => item.id === gated.id).words[0].srs
      .repetition,
    7,
  )
})

test('invalid catalogs and duplicate identities reject without mutating input', () => {
  const state = normalizeStorage({})
  const before = structuredClone(state)
  assert.throws(() => mergeRemoteCatalog(state, { protocolVersion: 2 }))
  const duplicate = structuredClone(catalog)
  duplicate.vocabularies.push(duplicate.vocabularies[0])
  assert.throws(() => mergeRemoteCatalog(state, duplicate))
  assert.deepEqual(state, before)
})

test('pre-remote production-like state migrates without losing words or SRS', () => {
  const source = mergeRemoteCatalog(
    normalizeStorage({
      organization: fixtures['connect-success'][1].organization,
    }),
    fixtures['catalog-organization'][1],
  )
  const legacy = {
    vocabularies: source.vocabularies.map(
      ({
        isRemote: _r,
        remoteVersion: _v,
        requiresOrganization: _g,
        ...item
      }) => item,
    ),
    settings: source.settings,
    userStats: source.userStats,
    activeVocabularyId: source.vocabularies[0].id,
    activeVocabularyIds: [source.vocabularies[0].id, 'private'],
  }
  legacy.vocabularies.push({
    ...structuredClone(legacy.vocabularies[0]),
    id: 'private',
    isBuiltin: false,
  })
  legacy.vocabularies[3].words[0].srs.repetition = 9
  const migrated = normalizeStorage(legacy)
  assert.deepEqual(migrated.activeVocabularyIds, legacy.activeVocabularyIds)
  assert.deepEqual(migrated.settings, legacy.settings)
  assert.deepEqual(migrated.userStats, legacy.userStats)
  assert.equal(migrated.remoteArchive[0].words[0].srs.repetition, 9)
  assert.deepEqual(migrated.vocabularies.at(-1), legacy.vocabularies.at(-1))
  assert.deepEqual(normalizeStorage(migrated), migrated)
})
