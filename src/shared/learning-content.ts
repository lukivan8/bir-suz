import type {
  ScriptVariant,
  Vocabulary,
  VocabularyCategory,
  WordItem,
} from './types'

const builtinVocabularyCsvFiles = import.meta.glob<string>(
  './builtin-vocabularies/*.csv',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
)

const defaultSourceLabel = 'qazaq tili'
const defaultTargetLabel = 'orys tili'
const defaultLevel = 'A2'

const srs = () => ({
  repetition: 0,
  interval: 1,
  easeFactor: 2.5,
  nextReview: 0,
})

type CsvMetadata = {
  name?: string
  description?: string
  category?: VocabularyCategory
}

type CsvCellMap = Record<string, string | undefined>

type ParsedCsv = {
  metadata: CsvMetadata
  headers: string[]
  rows: string[][]
  level?: WordItem['level']
}

const vocabularyCategories = new Set<VocabularyCategory>([
  'nouns',
  'verbs',
  'grammar',
  'mixed',
  'custom',
])

export const seedVocabularies: Vocabulary[] = Object.entries(
  builtinVocabularyCsvFiles,
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, csvText]) => buildVocabularyFromCsv(path, csvText))

export const seedVocabularyId =
  seedVocabularies[0]?.id ?? 'builtin-empty-vocabulary'

export const seedWords: WordItem[] = seedVocabularies[0]?.words ?? []

function buildVocabularyFromCsv(path: string, csvText: string): Vocabulary {
  const slug = slugFromPath(path)
  const parsed = parseCsvWithMetadata(csvText)
  const words = parsed.rows.map((row, index) =>
    buildWord(toCellMap(parsed.headers, row), slug, index, parsed.level),
  )

  return {
    id: `builtin-${slug}`,
    name: parsed.metadata.name ?? defaultNameFromSlug(slug),
    ...(parsed.metadata.description
      ? { description: parsed.metadata.description }
      : {}),
    category: parsed.metadata.category ?? defaultCategoryFromSlug(slug),
    isBuiltin: true,
    createdAt: 0,
    updatedAt: 0,
    words,
  }
}

function parseCsvWithMetadata(csvText: string): ParsedCsv {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  const metadata: CsvMetadata = {}
  const csvLines: string[] = []

  for (const line of lines) {
    if (line.trimStart().startsWith('#')) {
      addMetadata(metadata, line)
    } else {
      csvLines.push(line)
    }
  }

  if (csvLines.length === 0) {
    throw new Error('Built-in vocabulary CSV is empty.')
  }

  const [firstLine, ...remainingLines] = csvLines
  const firstRow = parseCsvLine(firstLine ?? '')
  const hasHeader = firstRow.map(normalizeHeader).some(isKnownCsvHeader)
  const headers = hasHeader
    ? firstRow.map(normalizeHeader)
    : ['kkCyrillic', 'ru']
  const rows = hasHeader
    ? remainingLines.map(parseCsvLine)
    : csvLines.map(parseCsvLine)
  const level = defaultLevelFromCsv(headers, metadata, rows)

  return {
    metadata,
    headers,
    rows,
    ...(level ? { level } : {}),
  }
}

function addMetadata(metadata: CsvMetadata, line: string) {
  const content = line.replace(/^\s*#\s?/, '')
  const separatorIndex = content.indexOf(':')
  if (separatorIndex === -1) return

  const key = content.slice(0, separatorIndex).trim().toLowerCase()
  const value = content.slice(separatorIndex + 1).trim()

  if (key === 'name') {
    metadata.name = value
  }

  if (key === 'description') {
    metadata.description = value
  }

  if (
    key === 'category' &&
    vocabularyCategories.has(value as VocabularyCategory)
  ) {
    metadata.category = value as VocabularyCategory
  }
}

function buildWord(
  cells: CsvCellMap,
  vocabularySlug: string,
  index: number,
  fallbackLevel: WordItem['level'] | undefined,
) {
  const kkLatin = firstValue(cells, ['kkLatin', 'sourceLatin', 'latin'])
  const kkCyrillic = firstValue(cells, [
    'kkCyrillic',
    'sourceCyrillic',
    'cyrillic',
  ])
  const sourceText =
    firstValue(cells, ['sourceText', 'source', 'kk', 'kazakh']) ??
    kkCyrillic ??
    kkLatin
  const targetText = firstValue(cells, [
    'targetText',
    'target',
    'ru',
    'russian',
  ])

  if (!sourceText || !targetText) {
    throw new Error(
      `Built-in vocabulary "${vocabularySlug}" has a row without Kazakh or Russian text.`,
    )
  }

  const sourceVariants = buildSourceVariants(sourceText, kkLatin, kkCyrillic)
  const id =
    firstValue(cells, ['id', 'wordId']) ??
    `${vocabularySlug}_${String(index + 1).padStart(3, '0')}`

  return {
    id,
    sourceText,
    targetText,
    ...(sourceVariants.length > 0 ? { sourceVariants } : {}),
    sourceLabel: firstValue(cells, ['sourceLabel']) ?? defaultSourceLabel,
    targetLabel: firstValue(cells, ['targetLabel']) ?? defaultTargetLabel,
    level:
      normalizeLevel(firstValue(cells, ['level'])) ??
      fallbackLevel ??
      defaultLevel,
    srs: srs(),
  } satisfies WordItem
}

function buildSourceVariants(
  sourceText: string,
  kkLatin: string | undefined,
  kkCyrillic: string | undefined,
) {
  const variants: ScriptVariant[] = []

  if (kkLatin && kkLatin !== sourceText) {
    variants.push({ script: 'latin', text: kkLatin })
  }

  if (kkCyrillic && kkCyrillic !== sourceText) {
    variants.push({ script: 'cyrillic', text: kkCyrillic })
  }

  return variants
}

function toCellMap(headers: string[], row: string[]): CsvCellMap {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index]?.trim()]),
  )
}

function firstValue(cells: CsvCellMap, keys: string[]) {
  for (const key of keys) {
    const value = cells[key]
    if (value) return value
  }

  return undefined
}

function normalizeLevel(
  value: string | undefined,
): WordItem['level'] | undefined {
  return value === 'A1' || value === 'A2' || value === 'B1' ? value : undefined
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let cell = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && nextCharacter === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      insideQuotes = !insideQuotes
    } else if (character === ',' && !insideQuotes) {
      cells.push(cell)
      cell = ''
    } else {
      cell += character
    }
  }

  cells.push(cell)
  return cells
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .replace(/[-_\s]+([a-zA-Z])/g, (_, letter: string) => letter.toUpperCase())
}

function isKnownCsvHeader(header: string) {
  return [
    'id',
    'wordId',
    'sourceText',
    'source',
    'kk',
    'kazakh',
    'kkCyrillic',
    'sourceCyrillic',
    'cyrillic',
    'kkLatin',
    'sourceLatin',
    'latin',
    'targetText',
    'target',
    'ru',
    'russian',
    'sourceLabel',
    'targetLabel',
    'level',
  ].includes(header)
}

function slugFromPath(path: string) {
  const fileName = path.split('/').at(-1) ?? path
  return fileName
    .replace(/\.csv$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function defaultNameFromSlug(slug: string) {
  const level = levelFromSlug(slug)

  if (slug.includes('verbs')) {
    return level ? `Глаголы ${level}` : 'Глаголы'
  }

  if (level) {
    return `Казахский ${level}`
  }

  return titleFromSlug(slug)
}

function defaultCategoryFromSlug(slug: string): VocabularyCategory {
  return slug.includes('verbs') ? 'verbs' : 'mixed'
}

function defaultLevelFromCsv(
  headers: string[],
  metadata: CsvMetadata,
  rows: string[][],
): WordItem['level'] | undefined {
  if (metadata.name) {
    const level = levelFromSlug(metadata.name)
    if (level) return level
  }

  const levelColumnIndex = headers.indexOf('level')
  if (levelColumnIndex >= 0) {
    const level = normalizeLevel(rows[0]?.[levelColumnIndex])
    if (level) return level
  }

  return undefined
}

function levelFromSlug(value: string): WordItem['level'] | undefined {
  const normalized = value.toLowerCase()

  if (normalized.includes('a1')) return 'A1'
  if (normalized.includes('a2')) return 'A2'
  if (normalized.includes('b1')) return 'B1'

  return undefined
}
