import { test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  advanceOnboarding,
  currentOnboardingStep,
} from '../src/shared/onboarding'
import { normalizeStorage } from '../src/shared/storage'

test('explanatory steps advance with Next without changing dictionaries or requiring cards', () => {
  let s = normalizeStorage({})
  const active = s.activeVocabularyIds
  assert.equal(currentOnboardingStep(s), 'intro')
  s = advanceOnboarding(s, { action: 'next', step: 'intro' })
  assert.equal(currentOnboardingStep(s), 'popup')
  assert.equal(advanceOnboarding(s, { action: 'skip-organization' }), s)
  s = advanceOnboarding(s, { action: 'next', step: 'popup' })
  assert.equal(currentOnboardingStep(normalizeStorage(s)), 'organization')
  // A repeated click from the preceding step must not advance the next one.
  assert.equal(advanceOnboarding(s, { action: 'next', step: 'popup' }), s)
  assert.equal(advanceOnboarding(s, { action: 'connected' }), s)
  s.organization = { id: 'synthetic', name: 'Synthetic', code: 'SYNTHETIC' }
  const org = s.organization
  s = advanceOnboarding(s, { action: 'skip-organization' })
  assert.equal(s.organization, org)
  assert.equal(s.onboarding.steps.organization, 'skipped')
  assert.equal(currentOnboardingStep(s), 'vocabulary')
  const settings = s.settings
  s = advanceOnboarding(s, { action: 'next', step: 'vocabulary' })
  assert.equal(s.activeVocabularyIds, active)
  assert.equal(s.catalogVersion, null)
  assert.equal(currentOnboardingStep(s), 'cards')
  assert.equal(s.settings, settings)
  s = advanceOnboarding(s, { action: 'next', step: 'cards' }, 1000)
  assert.equal(currentOnboardingStep(s), 'browser')
  assert.equal(s.studySession, null)
  assert.equal(s.onboarding.browserStepStartedAt, 1000)
  assert.equal(s.settings.analyticsEnabled, false)
})
test('final Next requires three answers, survives reload and cannot reopen', () => {
  let s = normalizeStorage({})
  s.onboarding.steps = {
    intro: 'completed',
    popup: 'completed',
    vocabulary: 'completed',
    organization: 'skipped',
    interval: 'completed',
    cards: 'completed',
  }
  assert.equal(advanceOnboarding(s, { action: 'next', step: 'browser' }), s)
  s.onboarding.browserAnswers = 3
  assert.equal(currentOnboardingStep(normalizeStorage(s)), 'browser')
  s = advanceOnboarding(s, { action: 'next', step: 'browser' }, 2000)
  assert.equal(s.onboarding.finishedAt, 2000)
  assert.equal(currentOnboardingStep(normalizeStorage(s)), undefined)
  assert.equal(advanceOnboarding(s, { action: 'next', step: 'popup' }), s)
})
test('previous automatic completion gets a final acknowledgement without losing progress', () => {
  const s = normalizeStorage({})
  s.onboarding.steps = {
    intro: 'completed',
    popup: 'completed',
    vocabulary: 'completed',
    organization: 'skipped',
    interval: 'completed',
    cards: 'completed',
    browser: 'completed',
  }
  s.onboarding.browserAnswers = 3
  s.onboarding.returnedAt = 1000
  assert.equal(currentOnboardingStep(s), 'browser')
  const next = advanceOnboarding(s, { action: 'next', step: 'browser' }, 2000)
  assert.equal(currentOnboardingStep(next), undefined)
  assert.equal(next.vocabularies, s.vocabularies)
  assert.equal(next.userStats, s.userStats)
})
