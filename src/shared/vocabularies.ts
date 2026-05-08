import type { StorageShape, Vocabulary, WordItem } from './types'

export function getActiveVocabulary(
  storage: Pick<StorageShape, 'vocabularies' | 'activeVocabularyId'>,
): Vocabulary | undefined {
  return (
    storage.vocabularies.find(
      (vocabulary) => vocabulary.id === storage.activeVocabularyId,
    ) ?? storage.vocabularies[0]
  )
}

export function getActiveWords(
  storage: Pick<StorageShape, 'vocabularies' | 'activeVocabularyId'>,
): WordItem[] {
  return getActiveVocabulary(storage)?.words ?? []
}

export function updateActiveVocabularyWords(
  storage: StorageShape,
  updateWords: (words: WordItem[]) => WordItem[],
  now = Date.now(),
): Vocabulary[] {
  const activeVocabulary = getActiveVocabulary(storage)
  if (!activeVocabulary) return storage.vocabularies

  return storage.vocabularies.map((vocabulary) => {
    if (vocabulary.id !== activeVocabulary.id) return vocabulary

    return {
      ...vocabulary,
      updatedAt: now,
      words: updateWords(vocabulary.words),
    }
  })
}
