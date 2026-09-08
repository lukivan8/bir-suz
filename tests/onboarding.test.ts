import { test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  advanceOnboarding,
  currentOnboardingStep,
  finishOnboardingCards,
} from '../src/shared/onboarding'
import fixtures from '../src/shared/protocol/fixtures.json'
import { mergeRemoteCatalog } from '../src/shared/remote-model'
import { normalizeStorage } from '../src/shared/storage'
import {
  flipStudyCard,
  rateStudyCard,
  showStudyCard,
  startStudy,
} from '../src/shared/study'

function loaded() {
  const catalog = structuredClone(fixtures['catalog-public'][1])
  catalog.vocabularies[0].words = Array.from({ length: 5 }, (_, i) => ({
    ...catalog.vocabularies[0].words[0],
    id: `synthetic-${i}`,
  }))
  return mergeRemoteCatalog(normalizeStorage({}), catalog)
}
test('sequential onboarding survives normalization; cold catalog and wrong connect cannot advance', () => {
  let state = normalizeStorage({})
  assert.equal(currentOnboardingStep(state), 'popup')
  assert.equal(advanceOnboarding(state, { action: 'skip-organization' }), state)
  state = advanceOnboarding(state, { action: 'popup' })
  assert.equal(currentOnboardingStep(normalizeStorage(state)), 'vocabulary')
  assert.equal(
    advanceOnboarding(state, {
      action: 'vocabulary',
      ids: ['builtin-kazakh-basic-words'],
    }),
    state,
  )
  state = advanceOnboarding(loaded(), { action: 'popup' })
  assert.equal(
    advanceOnboarding(state, { action: 'vocabulary', ids: [] }),
    state,
  )
  state = advanceOnboarding(state, {
    action: 'vocabulary',
    ids: state.vocabularies.map((v) => v.id),
  })
  assert.equal(state.activeVocabularyIds.length, 3)
  assert.equal(advanceOnboarding(state, { action: 'connected' }), state)
  state = advanceOnboarding(state, { action: 'skip-organization' })
  assert.equal(state.onboarding.steps.organization, 'skipped')
  assert.equal(currentOnboardingStep(state), 'cards')
  assert.equal(state.settings.analyticsEnabled, false)
})
test('five current onboarding ratings open browser; reset retains data and rejects old session', () => {
  let state = advanceOnboarding(loaded(), { action: 'popup' })
  state = advanceOnboarding(state, {
    action: 'vocabulary',
    ids: [state.vocabularies[0].id],
  })
  state.organization = { id: 'synthetic', name: 'Synthetic', code: 'SYNTHETIC' }
  state = advanceOnboarding(state, { action: 'connected' })
  assert.equal(state.onboarding.steps.organization, 'completed')
  state = startStudy(state, true, 1000)
  for (let i = 0; i < 5; i++) {
    state = showStudyCard(state, state.studySession.id, i, 1000)
    state = flipStudyCard(state, state.studySession.id, i)
    state = rateStudyCard(state, state.studySession.id, i, 1, 2000 + i)
    if (i < 4) assert.equal(finishOnboardingCards(state), state)
  }
  state = finishOnboardingCards(state)
  assert.equal(currentOnboardingStep(state), 'browser')
  const reset = advanceOnboarding(state, { action: 'reset' })
  assert.equal(reset.vocabularies, state.vocabularies)
  assert.equal(reset.userStats, state.userStats)
  assert.equal(reset.organization, state.organization)
  let again = advanceOnboarding(reset, { action: 'popup' })
  again = advanceOnboarding(again, {
    action: 'vocabulary',
    ids: again.activeVocabularyIds,
  })
  again = advanceOnboarding(again, { action: 'skip-organization' })
  assert.equal(finishOnboardingCards(again), again)
  assert.equal(again.organization, state.organization)
})
