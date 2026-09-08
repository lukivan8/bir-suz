import { calculateNextSrs, isDue } from './srs'
import type { Confidence, StorageShape, StudyCard, StudySession } from './types'
import { getActiveVocabularies } from './vocabularies'

export function confidenceQuality(confidence: Confidence): number {
  return { '-2': 0, '-1': 2, '0': 3, '1': 4, '2': 5 }[confidence]
}

export function startStudy(
  storage: StorageShape,
  onboarding = false,
  now = Date.now(),
  id = crypto.randomUUID(),
): StorageShape {
  if (storage.studySession && storage.studySession.completedAt === null)
    return storage
  if (storage.catalogVersion === null)
    throw new Error('Ожидаем загрузку словарей. Повторите загрузку.')
  const cards: StudyCard[] = getActiveVocabularies(storage).flatMap(
    (vocabulary) =>
      vocabulary.words.map((word) => ({
        vocabularyId: vocabulary.id,
        vocabularyName: vocabulary.name,
        isRemote: Boolean(vocabulary.isRemote),
        word: structuredClone(word),
      })),
  )
  // Intentional study is distinct from browser due-only triggering: new words,
  // then due reviews, then voluntary practice of the remaining active words.
  const priority = (card: StudyCard) =>
    !card.word.srs.lastReviewedAt
      ? 0
      : isDue(card.word.srs.nextReview, now)
        ? 1
        : 2
  const unique = new Map(
    cards.map((card) => [
      JSON.stringify([card.vocabularyId, card.word.id]),
      card,
    ]),
  )
  const selected = [...unique.values()]
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, 5)
  if (selected.length === 0)
    throw new Error('В активных словарях пока нет слов.')
  return {
    ...storage,
    studySession: {
      id,
      onboarding,
      cards: selected,
      index: 0,
      results: [],
      shownAt: null,
      flipped: false,
      completedAt: null,
    },
  }
}

export function showStudyCard(
  storage: StorageShape,
  sessionId: string,
  index: number,
  now = Date.now(),
): StorageShape {
  const session = currentCard(storage, sessionId, index)
  if (!session || session.shownAt !== null) return storage
  return { ...storage, studySession: { ...session, shownAt: now } }
}

export function flipStudyCard(
  storage: StorageShape,
  sessionId: string,
  index: number,
): StorageShape {
  const session = currentCard(storage, sessionId, index)
  if (!session || session.shownAt === null) return storage
  return { ...storage, studySession: { ...session, flipped: true } }
}

export function rateStudyCard(
  storage: StorageShape,
  sessionId: string,
  index: number,
  confidence: Confidence,
  now = Date.now(),
): StorageShape {
  if (![-2, -1, 0, 1, 2].includes(confidence))
    throw new Error('Invalid confidence')
  const session = currentCard(storage, sessionId, index)
  if (!session || session.shownAt === null || !session.flipped) return storage
  const card = session.cards[index]
  if (!card) return storage
  const vocabulary = [...storage.vocabularies, ...storage.remoteArchive].find(
    (v) => v.id === card.vocabularyId,
  )
  const existing = vocabulary?.words.find((w) => w.id === card.word.id)
  const srs = calculateNextSrs(
    existing?.srs ?? card.word.srs,
    confidenceQuality(confidence),
    now,
  )
  const update = (vocabularies: StorageShape['vocabularies']) =>
    vocabularies.map((v) =>
      v.id !== card.vocabularyId
        ? v
        : {
            ...v,
            words: v.words.map((w) =>
              w.id === card.word.id ? { ...w, srs } : w,
            ),
          },
    )
  const nextIndex = index + 1
  return {
    ...storage,
    vocabularies: update(storage.vocabularies),
    remoteArchive: update(storage.remoteArchive),
    studySession: {
      ...session,
      index: nextIndex,
      shownAt: null,
      flipped: false,
      results: [
        ...session.results,
        {
          index,
          confidence,
          durationMs: Math.max(0, now - session.shownAt),
          srs,
        },
      ],
      completedAt: nextIndex === session.cards.length ? now : null,
    },
  }
}

function currentCard(
  storage: StorageShape,
  sessionId: string,
  index: number,
): StudySession | null {
  const session = storage.studySession
  return session?.id === sessionId &&
    session.index === index &&
    session.completedAt === null
    ? session
    : null
}
