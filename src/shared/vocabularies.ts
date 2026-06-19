import type { StorageShape, Vocabulary, WordItem } from './types'

export function getActiveVocabulary(
  storage: Pick<
    StorageShape,
    'vocabularies' | 'activeVocabularyId' | 'activeVocabularyIds'
  >,
): Vocabulary | undefined {
  return (
    storage.vocabularies.find(
      (vocabulary) => vocabulary.id === storage.activeVocabularyId,
    ) ?? storage.vocabularies[0]
  )
}

export function getActiveVocabularies(
  storage: Pick<
    StorageShape,
    'vocabularies' | 'activeVocabularyId' | 'activeVocabularyIds'
  >,
): Vocabulary[] {
  const activeVocabularyIds = new Set(storage.activeVocabularyIds)
  const vocabularies = storage.vocabularies.filter((vocabulary) =>
    activeVocabularyIds.has(vocabulary.id),
  )

  return vocabularies.length > 0
    ? vocabularies
    : [getActiveVocabulary(storage)].filter(
        (vocabulary): vocabulary is Vocabulary => Boolean(vocabulary),
      )
}

export function getActiveWords(
  storage: Pick<
    StorageShape,
    'vocabularies' | 'activeVocabularyId' | 'activeVocabularyIds'
  >,
): WordItem[] {
  return getActiveVocabularies(storage).flatMap(
    (vocabulary) => vocabulary.words,
  )
}

export function updateActiveVocabularyWords(
  storage: StorageShape,
  updateWords: (words: WordItem[]) => WordItem[],
  now = Date.now(),
): Vocabulary[] {
  const activeVocabularyIds = new Set(storage.activeVocabularyIds)

  return storage.vocabularies.map((vocabulary) => {
    if (!activeVocabularyIds.has(vocabulary.id)) return vocabulary

    return {
      ...vocabulary,
      updatedAt: now,
      words: updateWords(vocabulary.words),
    }
  })
}
