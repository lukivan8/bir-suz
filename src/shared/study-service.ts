import { currentOnboardingStep, finishOnboardingCards } from './onboarding'
import { getStorage, updateStorage, withStorageLock } from './storage'
import {
  flipStudyCard,
  rateStudyCard,
  showStudyCard,
  startStudy,
} from './study'
import type { Confidence } from './types'

export type StudyAction =
  | { action: 'start'; onboarding: boolean }
  | { action: 'show'; sessionId: string; index: number }
  | { action: 'flip'; sessionId: string; index: number }
  | { action: 'rate'; sessionId: string; index: number; confidence: Confidence }

export async function studyAction(action: StudyAction) {
  return withStorageLock(async () => {
    try {
      const current = await getStorage()
      if (
        action.action === 'start' &&
        action.onboarding &&
        currentOnboardingStep(current) !== 'cards'
      )
        throw new Error('Onboarding not ready')
      let next =
        action.action === 'start'
          ? startStudy(current, action.onboarding)
          : action.action === 'show'
            ? showStudyCard(current, action.sessionId, action.index)
            : action.action === 'flip'
              ? flipStudyCard(current, action.sessionId, action.index)
              : rateStudyCard(
                  current,
                  action.sessionId,
                  action.index,
                  action.confidence,
                )
      next = finishOnboardingCards(next)
      if (next !== current)
        await updateStorage({
          studySession: next.studySession,
          onboarding: next.onboarding,
          vocabularies: next.vocabularies,
          remoteArchive: next.remoteArchive,
        })
      return { ok: true as const, session: next.studySession }
    } catch {
      return {
        ok: false as const,
        error:
          'Нет доступных карточек. Дождитесь загрузки словарей и повторите.',
      }
    }
  })
}
