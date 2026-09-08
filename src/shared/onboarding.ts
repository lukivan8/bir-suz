import { persistLearningTransition } from './stats'
import { getStorage, withStorageLock } from './storage'
import type { StorageShape } from './types'

export const onboardingSteps = [
  'intro',
  'popup',
  'organization',
  'vocabulary',
  'cards',
  'browser',
] as const
export type OnboardingStep = (typeof onboardingSteps)[number]
export function currentOnboardingStep(
  state: StorageShape,
): OnboardingStep | undefined {
  if (state.onboarding.finishedAt) return undefined
  // Older builds completed the browser step automatically. Keep the final
  // acknowledgement visible until the user explicitly finishes the introduction.
  return (
    onboardingSteps.find((step) => !state.onboarding.steps[step]) ?? 'browser'
  )
}
export type OnboardingAction =
  | { action: 'next'; step: Exclude<OnboardingStep, 'organization'> }
  | { action: 'skip-organization' | 'connected' }

export function advanceOnboarding(
  state: StorageShape,
  action: OnboardingAction,
  now = Date.now(),
): StorageShape {
  const step = currentOnboardingStep(state)
  if (!step) return state
  let status: 'completed' | 'skipped' = 'completed'
  if (action.action === 'next') {
    if (step !== action.step) return state
    if (step === 'browser' && state.onboarding.browserAnswers < 3) return state
  } else {
    if (step !== 'organization') return state
    if (action.action === 'connected' && !state.organization) return state
    if (action.action === 'skip-organization') status = 'skipped'
  }
  return {
    ...state,
    onboarding: {
      ...state.onboarding,
      runId: state.onboarding.runId || crypto.randomUUID(),
      steps: { ...state.onboarding.steps, [step]: status },
      ...(step === 'cards'
        ? { browserStepStartedAt: now, browserAnswers: 0 }
        : {}),
      ...(step === 'browser' ? { finishedAt: now, returnedAt: now } : {}),
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
