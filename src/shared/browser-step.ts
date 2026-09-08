import { currentOnboardingStep } from './onboarding'
import { getStorage, updateStorage, withStorageLock } from './storage'
import type { ChallengeResult, PendingChallenge, StorageShape } from './types'

export function consumeChallenge(
  state: StorageShape,
  result: ChallengeResult,
  tabId?: number,
): { state: StorageShape; issued: PendingChallenge } | null {
  const issued = result.challengeId
    ? state.pendingChallenges[result.challengeId]
    : undefined
  if (
    !issued ||
    issued.tabId !== tabId ||
    issued.wordId !== result.wordId ||
    issued.vocabularyId !== result.vocabularyId ||
    issued.source !== result.source
  )
    return null
  const pendingChallenges = { ...state.pendingChallenges }
  delete pendingChallenges[issued.id]
  let onboarding = state.onboarding
  if (
    currentOnboardingStep(state) === 'browser' &&
    !result.wasSkipped &&
    issued.source !== 'demo-hotkey' &&
    issued.onboardingRunId &&
    issued.onboardingRunId === onboarding.runId &&
    issued.createdAt >= (onboarding.browserStepStartedAt ?? Infinity)
  ) {
    const browserAnswers = Math.min(3, onboarding.browserAnswers + 1)
    onboarding = {
      ...onboarding,
      browserAnswers,
      steps: {
        ...onboarding.steps,
        ...(browserAnswers === 3 ? { browser: 'completed' as const } : {}),
      },
    }
  }
  return { state: { ...state, pendingChallenges, onboarding }, issued }
}
export async function refreshOnboardingBadge() {
  return navigator.locks.request('bir-soz-badge', async () => {
    const state = await getStorage()
    await chrome.action.setBadgeText({
      text:
        state.onboarding.browserAnswers === 3 && !state.onboarding.returnedAt
          ? '✓'
          : '',
    })
    await chrome.action.setBadgeBackgroundColor({ color: '#95633b' })
  })
}
export async function visitCompletedOnboarding() {
  await withStorageLock(async () => {
    const state = await getStorage()
    if (state.onboarding.browserAnswers === 3 && !state.onboarding.returnedAt)
      await updateStorage({
        onboarding: { ...state.onboarding, returnedAt: Date.now() },
      })
  })
  await refreshOnboardingBadge()
}
