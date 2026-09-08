import { PUBLIC_VOCABULARY_IDS } from './remote-model'
import { persistLearningTransition } from './stats'
import { getStorage, withStorageLock } from './storage'
import type { StorageShape } from './types'

export const onboardingSteps = [
  'popup',
  'vocabulary',
  'organization',
  'cards',
  'browser',
] as const
export function currentOnboardingStep(state: StorageShape) {
  return onboardingSteps.find((step) => !state.onboarding.steps[step])
}
export type OnboardingAction =
  | { action: 'popup' | 'skip-organization' | 'connected' | 'reset' }
  | { action: 'vocabulary'; ids: string[] }

export function advanceOnboarding(
  state: StorageShape,
  action: OnboardingAction,
): StorageShape {
  if (action.action === 'reset')
    return {
      ...state,
      onboarding: {
        version: 1,
        steps: {},
        browserAnswers: 0,
        runId: crypto.randomUUID(),
      },
    }
  const step = currentOnboardingStep(state)
  let status: 'completed' | 'skipped' = 'completed'
  let patch: Partial<StorageShape> = {}
  if (action.action === 'popup' && step !== 'popup') return state
  if (action.action === 'vocabulary') {
    if (step !== 'vocabulary' || state.catalogVersion === null) return state
    const available = state.vocabularies.filter((v) => v.isRemote)
    const ids = [...new Set(action.ids)].filter((id) =>
      available.some((v) => v.id === id),
    )
    if (
      !ids.length ||
      !ids.some((id) =>
        Object.values(PUBLIC_VOCABULARY_IDS).some(
          (publicId) => publicId === id,
        ),
      )
    )
      return state
    patch = {
      activeVocabularyIds: ids,
      activeVocabularyId: ids[0] ?? state.activeVocabularyId,
    }
  }
  if (action.action === 'connected' || action.action === 'skip-organization') {
    if (step !== 'organization') return state
    if (action.action === 'connected' && !state.organization) return state
    if (action.action === 'skip-organization') status = 'skipped'
  }
  if (!step) return state
  return {
    ...state,
    ...patch,
    onboarding: {
      ...state.onboarding,
      runId: state.onboarding.runId || crypto.randomUUID(),
      steps: { ...state.onboarding.steps, [step]: status },
    },
  }
}

export function finishOnboardingCards(state: StorageShape): StorageShape {
  const session = state.studySession
  if (
    currentOnboardingStep(state) !== 'cards' ||
    !session?.onboarding ||
    session.onboardingRunId !== state.onboarding.runId ||
    session.completedAt === null ||
    session.results.length !== 5 ||
    session.cards.length !== 5
  )
    return state
  return {
    ...state,
    onboarding: {
      ...state.onboarding,
      steps: { ...state.onboarding.steps, cards: 'completed' },
      browserStepStartedAt: session.completedAt,
      browserAnswers: 0,
    },
  }
}

export async function onboardingAction(action: OnboardingAction) {
  return withStorageLock(async () => {
    const state = await getStorage()
    const next = advanceOnboarding(state, action)
    if (next !== state) await persistLearningTransition(state, next)
  })
}
