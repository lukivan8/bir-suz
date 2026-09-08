import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { consumeChallenge } from '../src/shared/browser-step'
import { normalizeStorage } from '../src/shared/storage'
import type { ChallengeResult, PendingChallenge } from '../src/shared/types'

const issued: PendingChallenge = {
  id: 'synthetic',
  vocabularyId: 'synthetic-v',
  wordId: 'synthetic-w',
  source: 'navigation',
  tabId: 1,
  createdAt: 100,
  onboardingRunId: 'run',
}
const result: ChallengeResult = {
  challengeId: issued.id,
  vocabularyId: issued.vocabularyId,
  wordId: issued.wordId,
  source: 'navigation',
  elapsedMs: 5,
  wasCorrect: false,
  wasSkipped: false,
  timedOut: false,
}
function consumed(
  s: ReturnType<typeof normalizeStorage>,
  r: ChallengeResult,
  tabId: number,
) {
  const value = consumeChallenge(s, r, tabId)
  assert.ok(value)
  return value
}
function state() {
  const s = normalizeStorage({})
  s.onboarding = {
    version: 1,
    steps: {
      popup: 'completed',
      vocabulary: 'completed',
      organization: 'skipped',
      cards: 'completed',
    },
    browserAnswers: 0,
    runId: 'run',
    browserStepStartedAt: 100,
  }
  s.pendingChallenges = { synthetic: issued }
  return s
}
test('three natural wrong/right answers persist once across reload and preserve cooldown', () => {
  let s = state()
  for (let n = 1; n <= 3; n++) {
    s.pendingChallenges = { synthetic: issued }
    s = consumed(
      normalizeStorage(s),
      { ...result, wasCorrect: n === 2 },
      1,
    ).state
    assert.equal(s.onboarding.browserAnswers, n)
    assert.equal(consumeChallenge(s, result, 1), null)
  }
  assert.equal(s.onboarding.steps.browser, 'completed')
  assert.equal(s.settings.cooldownMinutes, 3)
})
test('skip, demo, prior-step, prior-run and unissued results cannot count', () => {
  for (const patch of [
    { source: 'demo-hotkey' as const },
    { createdAt: 99 },
    { onboardingRunId: undefined },
    { onboardingRunId: 'old' },
  ]) {
    const s = state()
    s.pendingChallenges = { synthetic: { ...issued, ...patch } }
    assert.equal(
      consumed(
        s,
        { ...result, source: s.pendingChallenges.synthetic.source },
        1,
      ).state.onboarding.browserAnswers,
      0,
    )
  }
  assert.equal(
    consumed(state(), { ...result, wasSkipped: true }, 1).state.onboarding
      .browserAnswers,
    0,
  )
  assert.equal(consumeChallenge(state(), result, 2), null)
  assert.equal(
    consumeChallenge(state(), { ...result, challengeId: 'unknown' }, 1),
    null,
  )
  const before = state()
  delete before.onboarding.steps.cards
  assert.equal(consumed(before, result, 1).state.onboarding.browserAnswers, 0)
})

test('issued vocabulary receives SRS after selection change and access archive', async () => {
  const { applyChallengeResult } = await import('../src/shared/challenge')
  const { mergeRemoteCatalog } = await import('../src/shared/remote-model')
  const fixtures = (await import('../src/shared/protocol/fixtures.json'))
    .default
  const s = mergeRemoteCatalog(
    normalizeStorage({}),
    fixtures['catalog-public'][1],
  )
  const vocabulary = s.vocabularies[0]
  const word = vocabulary.words[0]
  s.remoteArchive = [vocabulary]
  s.vocabularies = s.vocabularies.slice(1)
  s.activeVocabularyIds = [s.vocabularies[0].id]
  const next = applyChallengeResult(
    s,
    {
      ...result,
      vocabularyId: vocabulary.id,
      wordId: word.id,
      wasCorrect: true,
    },
    1000,
  )
  assert.equal(next.remoteArchive[0].words[0].srs.lastReviewedAt, 1000)
  assert.deepEqual(next.vocabularies, s.vocabularies)
})
