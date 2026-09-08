import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { applyChallengeResult, pickDueWord } from '../src/shared/challenge'
import fixtures from '../src/shared/protocol/fixtures.json'
import { mergeRemoteCatalog } from '../src/shared/remote-model'
import { normalizeStorage } from '../src/shared/storage'
import {
  confidenceQuality,
  flipStudyCard,
  rateStudyCard,
  showStudyCard,
  startStudy,
} from '../src/shared/study'
import type { Confidence } from '../src/shared/types'

function state() {
  const catalog = structuredClone(fixtures['catalog-public'][1])
  const vocabulary = catalog.vocabularies[0]
  vocabulary.words = Array.from({ length: 7 }, (_, index) => ({
    ...vocabulary.words[0],
    id: `synthetic-${index}`,
    kk: `word ${index}`,
  }))
  const storage = mergeRemoteCatalog(normalizeStorage({}), catalog)
  storage.userStats.timeInLanguageContactMs = 12345
  return storage
}

test('all confidence mappings and available active cards', () => {
  assert.deepEqual(
    ([-2, -1, 0, 1, 2] as Confidence[]).map(confidenceQuality),
    [0, 2, 3, 4, 5],
  )
  const started = startStudy(state(), true, 1000)
  assert.equal(started.studySession.cards.length, 7)
  assert.equal(
    new Set(started.studySession.cards.map((c) => c.word.id)).size,
    7,
  )
  assert.equal(started.studySession.onboarding, true)
  assert.throws(() => startStudy(normalizeStorage({})))
})

test('each rating persists SRS/index, restart resumes and duplicates do nothing', () => {
  let storage = startStudy(state(), true, 1000)
  const id = storage.studySession.id
  for (const [index, confidence] of (
    [-2, -1, 0, 1, 2, 1, 2] as Confidence[]
  ).entries()) {
    storage = showStudyCard(storage, id, index, 2000)
    assert.equal(rateStudyCard(storage, id, index, confidence, 3000), storage)
    storage = flipStudyCard(storage, id, index)
    storage = rateStudyCard(storage, id, index, confidence, 122001)
    assert.equal(storage.studySession.index, index + 1)
    assert.equal(storage.studySession.results.length, index + 1)
    assert.equal(
      storage.vocabularies[0].words[index].srs.lastReviewedAt,
      122001,
    )
    assert.equal(rateStudyCard(storage, id, index, confidence, 122002), storage)
    storage = normalizeStorage(structuredClone(storage))
    if (index < 6) assert.equal(startStudy(storage), storage)
  }
  assert.equal(storage.studySession.completedAt, 122001)
  assert.notEqual(startStudy(storage).studySession.id, id)
  assert.equal(storage.userStats.timeInLanguageContactMs, 12345)
})

test('snapshot survives remote update and raw duration is never clipped', () => {
  let storage = startStudy(state())
  const id = storage.studySession.id
  storage = showStudyCard(storage, id, 0, 1000)
  storage.vocabularies[0].words[0].sourceText = 'Changed server text'
  assert.equal(storage.studySession.cards[0].word.sourceText, 'word 0')
  storage = flipStudyCard(storage, id, 0)
  storage = rateStudyCard(storage, id, 0, 2, 3601000)
  assert.equal(storage.studySession.results[0].durationMs, 3600000)
})

test('browser picker never falls back to not-due reviews; explicit study prioritizes new', () => {
  const storage = state()
  const words = storage.vocabularies[0].words
  for (const word of words)
    word.srs = { ...word.srs, lastReviewedAt: 1, nextReview: 999999 }
  assert.equal(pickDueWord(words, 1000), undefined)
  words[3].srs.lastReviewedAt = undefined
  words[3].srs.nextReview = 0
  assert.equal(pickDueWord(words, 1000).id, words[3].id)
  assert.equal(
    startStudy(storage, false, 1000).studySession.cards[0].word.id,
    words[3].id,
  )
  const result = {
    wordId: words[3].id,
    source: 'navigation' as const,
    elapsedMs: 3600000,
    wasSkipped: false,
    wasCorrect: true,
    timedOut: false,
  }
  assert.equal(
    applyChallengeResult(storage, result, 1000).userStats
      .timeInLanguageContactMs,
    12345,
  )
})

test('short catalog returns actual size and ratings update archived vocabulary', () => {
  const storage = mergeRemoteCatalog(
    normalizeStorage({}),
    fixtures['catalog-public'][1],
  )
  let next = startStudy(storage)
  assert.equal(next.studySession.cards.length, 1)
  const id = next.studySession.id
  next = showStudyCard(next, id, 0, 1000)
  next = flipStudyCard(next, id, 0)
  next.remoteArchive = next.vocabularies
  next.vocabularies = []
  next = rateStudyCard(next, id, 0, 2, 5000)
  assert.equal(next.remoteArchive[0].words[0].srs.repetition, 1)
})

test('continuous working sets rotate through all words without growing storage', () => {
  let s = state()
  const first = s.vocabularies[0].words[0]
  s.vocabularies[0].words = Array.from({ length: 25 }, (_, i) => ({
    ...structuredClone(first),
    id: `rotation-${i}`,
  }))
  s = startStudy(s, false, 1000)
  const seen = new Set<string>()
  for (let n = 0; n < 60; n++) {
    if (s.studySession.completedAt !== null) s = startStudy(s, false, 1000 + n)
    const { id, index, cards } = s.studySession
    seen.add(cards[index].word.id)
    s = showStudyCard(s, id, index, 1000 + n)
    s = flipStudyCard(s, id, index)
    s = rateStudyCard(s, id, index, 2, 1001 + n)
    assert.ok(s.studySession.cards.length <= 20)
    assert.ok(s.studySession.results.length <= 20)
  }
  assert.equal(seen.size, 25)
})
