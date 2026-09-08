import type { AnalyticsEventV2 } from './api-contract'
import type { ChallengeResult, StorageShape } from './types'

type EventInput = Omit<AnalyticsEventV2, 'id' | 'installationId' | 'occurredAt'>
export function transitionEvents(
  before: StorageShape,
  after: StorageShape,
  result?: ChallengeResult,
): EventInput[] {
  if (!after.settings.analyticsEnabled) return []
  const events: EventInput[] = []
  const remote = (id?: string) =>
    [
      ...before.vocabularies,
      ...before.remoteArchive,
      ...after.vocabularies,
      ...after.remoteArchive,
    ].some((v) => v.id === id && v.isRemote)
  const add = (event: EventInput) => {
    if (!event.vocabularyId || remote(event.vocabularyId)) events.push(event)
  }
  if (
    before.onboarding.runId !== after.onboarding.runId &&
    after.onboarding.runId
  )
    add({ type: 'onboarding_started' })
  for (const [step, status] of Object.entries(after.onboarding.steps)) {
    if (before.onboarding.steps[step] !== status)
      add({
        type: 'onboarding_step_completed',
        onboardingStep: status === 'skipped' ? `${step}:skipped` : step,
      })
  }
  if (!before.onboarding.finishedAt && after.onboarding.finishedAt)
    add({ type: 'onboarding_completed' })
  if (!before.organization && after.organization)
    add({
      type: 'organization_connected',
      organizationId: after.organization.id,
    })
  for (const id of after.activeVocabularyIds)
    if (!before.activeVocabularyIds.includes(id))
      add({ type: 'dictionary_activated', vocabularyId: id })
  const previous = before.studySession,
    session = after.studySession
  if (session && session.id !== previous?.id) {
    for (const vocabularyId of new Set(
      session.cards.filter((c) => c.isRemote).map((c) => c.vocabularyId),
    ))
      add({
        type: 'study_session_started',
        sessionId: session.id,
        vocabularyId,
      })
  }
  if (session && session.id === previous?.id) {
    for (const rating of session.results.slice(previous.results.length)) {
      const card = session.cards[rating.index]
      if (card?.isRemote)
        add({
          type: 'study_card_rated',
          sessionId: session.id,
          vocabularyId: card.vocabularyId,
          wordId: card.word.id,
          confidence: rating.confidence,
          durationMs: rating.durationMs,
        })
    }
    if (previous.completedAt === null && session.completedAt !== null) {
      for (const vocabularyId of new Set(
        session.cards.filter((c) => c.isRemote).map((c) => c.vocabularyId),
      ))
        add({
          type: 'study_session_completed',
          sessionId: session.id,
          vocabularyId,
        })
    }
  }
  if (result?.vocabularyId)
    add(
      result.wasSkipped
        ? {
            type: 'challenge_skipped',
            vocabularyId: result.vocabularyId,
            wordId: result.wordId,
          }
        : {
            type: 'challenge_completed',
            vocabularyId: result.vocabularyId,
            wordId: result.wordId,
            correct: result.wasCorrect,
            durationMs: result.elapsedMs,
          },
    )
  return events.map((event) => ({
    ...event,
    ...(after.organization ? { organizationId: after.organization.id } : {}),
  }))
}
