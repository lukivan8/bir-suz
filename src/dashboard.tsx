import { createResource, createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'
import { calculateCurrentStreak } from './shared/challenge'
import type { RuntimeMessage, RuntimeResponseFor } from './shared/messages'
import type { StorageShape, Vocabulary, WordItem } from './shared/types'
import { isStorageShape } from './shared/validation'

const DAY_MS = 24 * 60 * 60 * 1000
const HEATMAP_WEEKS = 13
type MasteryFilter = 'all' | 'mastered' | 'in-progress' | 'new'
interface ActivityDay {
  key: string
  label: string
  count: number
  correct: number
  isToday: boolean
}

async function getState() {
  const response = await sendRuntimeMessage({
    type: 'bir-soz:get-state',
  })

  if (!isStorageShape(response)) {
    throw new Error('Invalid storage state response')
  }

  return response
}

function Dashboard() {
  const [state, { mutate }] = createResource(getState)
  const [advancedOpen, setAdvancedOpen] = createSignal(false)
  const [masteryFilter, setMasteryFilter] = createSignal<MasteryFilter>('all')
  const [selectedVocabularyId, setSelectedVocabularyId] = createSignal<string>()

  const updateSettings = async (patch: Partial<StorageShape['settings']>) => {
    const current = state()
    if (!current) return

    const next = {
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
    }

    mutate(next)
    await chrome.storage.local.set({ settings: next.settings })
  }

  const updateQuietHours = async (
    patch: Partial<StorageShape['settings']['quietHours']>,
  ) => {
    const current = state()
    if (!current) return
    await updateSettings({
      quietHours: {
        ...current.settings.quietHours,
        ...patch,
      },
    })
  }

  const activityDays = () => buildActivityDays(state())
  const activityMonths = () => buildActivityMonths(activityDays())
  const activityWeekdays = () => buildActivityWeekdays()
  const selectedVocabulary = () => getSelectedVocabulary(state(), selectedVocabularyId())
  const dictionaryWords = () =>
    getDictionaryWords(selectedVocabulary(), masteryFilter())
  const masteredWordCount = () =>
    countWordsByMastery(selectedVocabulary(), 'mastered')
  const activeWordCount = () =>
    countWordsByMastery(selectedVocabulary(), 'in-progress')
  const currentStreak = () =>
    calculateCurrentStreak(state()?.userStats.dailyReviewHistory ?? [])

  const makeVocabularyActive = async (vocabularyId: string) => {
    const current = state()
    if (!current) return

    const next = {
      ...current,
      activeVocabularyId: vocabularyId,
    }

    mutate(next)
    await chrome.storage.local.set({ activeVocabularyId: vocabularyId })
  }

  return (
    <main class="dashboard-page">
      <div class="dashboard-shell">
        <Show when={state()}>
          {(current) => (
            <>
              <div class="dashboard-actions">
                <div class="dashboard-wordmark">Bir söz</div>
                <button
                  type="button"
                  class="advanced-settings-button"
                  onClick={() => setAdvancedOpen(true)}
                >
                  Доп. настройки
                </button>
              </div>

              <section class="dashboard-section">
                <span class="section-num">01 — Серия</span>
                <h1 class="section-heading">
                  Ритм, который держится {currentStreak()} дней
                </h1>
                <div class="activity-panel">
                  <div class="activity-stats">
                    <StatBlock
                      label="Лучшая серия"
                      value={current().userStats.bestStreak}
                      unit="дней"
                    />
                    <StatBlock
                      label="Всего решено"
                      value={current().userStats.totalCorrect}
                      unit="задач"
                    />
                  </div>
                  <div class="heatmap-frame">
                    <div class="heatmap-months">
                      <For each={activityMonths()}>
                        {(month) => <span>{month}</span>}
                      </For>
                    </div>
                    <div class="heatmap-body">
                      <div class="heatmap-weekdays">
                        <For each={activityWeekdays()}>
                          {(day) => <span>{day}</span>}
                        </For>
                      </div>
                      <div
                        class="activity-heatmap"
                        role="img"
                        aria-label="Активность за последние 13 недель"
                      >
                        <For each={activityDays()}>
                          {(day) => (
                            <button
                              type="button"
                              class="heatmap-day"
                              classList={{
                                today: day.isToday,
                                'level-1': day.correct > 0 && day.correct < 10,
                                'level-2':
                                  day.correct >= 10 && day.correct < 25,
                                'level-3':
                                  day.correct >= 25 && day.correct < 50,
                                'level-4':
                                  day.correct >= 50 && day.correct < 100,
                                'level-5': day.correct >= 100,
                              }}
                              data-tooltip={`${day.label}: ${day.count} заданий, ${day.correct} решено`}
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="dashboard-section">
                <span class="section-num">02 — Словарь</span>
                <Show
                  when={selectedVocabulary()}
                  fallback={
                    <VocabularyOverview
                      storage={current()}
                      onSelect={(vocabularyId) => {
                        setSelectedVocabularyId(vocabularyId)
                        setMasteryFilter('all')
                      }}
                    />
                  }
                >
                  {(vocabulary) => (
                    <>
                      <div class="section-heading-row">
                        <h2 class="section-heading">{vocabulary().name}</h2>
                        <div class="table-tools vocabulary-title-actions">
                          <span>{dictionaryWords().length} слов</span>
                          <button
                            type="button"
                            onClick={() => setSelectedVocabularyId(undefined)}
                          >
                            ← Все словари
                          </button>
                          <button
                            type="button"
                            disabled={
                              current().activeVocabularyId === vocabulary().id
                            }
                            onClick={() => makeVocabularyActive(vocabulary().id)}
                          >
                            {current().activeVocabularyId === vocabulary().id
                              ? 'Активный'
                              : 'Сделать активным'}
                          </button>
                        </div>
                      </div>
                      <div class="table-tools">
                        <label>
                          Уровень освоения
                          <select
                            value={masteryFilter()}
                            onChange={(event) => {
                              const value = event.currentTarget.value
                              if (isMasteryFilter(value)) {
                                setMasteryFilter(value)
                              }
                            }}
                          >
                            <option value="all">Все</option>
                            <option value="mastered">Освоенные</option>
                            <option value="in-progress">В работе</option>
                            <option value="new">Новые</option>
                          </select>
                        </label>
                      </div>
                      <div class="vocab-grid compact-vocab-grid">
                        <MetricPanel
                          label="В работе"
                          value={activeWordCount()}
                          body="слов сейчас повторяются"
                          note="уже встречались, ещё не освоены"
                        />
                        <MetricPanel
                          label="Освоенные слова"
                          value={masteredWordCount()}
                          body="слов узнаёшь без подсказки"
                          note="верно 3 раза подряд, повтор реже недели"
                          accent
                        />
                      </div>
                      <Show
                        when={dictionaryWords().length > 0}
                        fallback={
                          <div class="empty-state">
                            Ничего не найдено. <em>Попробуй другой фильтр.</em>
                          </div>
                        }
                      >
                        <div class="mastered-table dictionary-table-scroll">
                          <For each={dictionaryWords()}>
                            {(word) => (
                              <div class="mastered-row">
                                <span>{word.sourceText}</span>
                                <em>{word.targetText}</em>
                                <span>{masteryLabel(word)}</span>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </>
                  )}
                </Show>
              </section>
              <Show when={advancedOpen()}>
                <AdvancedSettingsModal
                  settings={current().settings}
                  onClose={() => setAdvancedOpen(false)}
                  onSettingsChange={updateSettings}
                  onQuietHoursChange={updateQuietHours}
                />
              </Show>
            </>
          )}
        </Show>
      </div>
    </main>
  )
}

function StatBlock(props: {
  label: string
  value: number
  unit: string
  faded?: boolean
}) {
  return (
    <div class="stat-block">
      <span>{props.label}</span>
      <strong classList={{ faded: props.faded }}>{props.value}</strong>
      <span>{props.unit}</span>
    </div>
  )
}

function MetricPanel(props: {
  label: string
  value: number
  body: string
  note: string
  accent?: boolean
}) {
  return (
    <div class="metric-panel">
      <span>{props.label}</span>
      <strong classList={{ accent: props.accent }}>{props.value}</strong>
      <p>{props.body}</p>
      <small>{props.note}</small>
    </div>
  )
}

function VocabularyOverview(props: {
  storage: StorageShape
  onSelect: (vocabularyId: string) => void
}) {
  return (
    <>
      <div class="section-heading-row">
        <h2 class="section-heading">
          Все словари, <em>выбери набор</em>.
        </h2>
        <span class="table-count">
          {props.storage.vocabularies.length} словаря
        </span>
      </div>
      <div class="grid grid-cols-3 gap-6 max-[760px]:grid-cols-1">
        <For each={props.storage.vocabularies}>
          {(vocabulary) => {
            const progress = () => vocabularyProgress(vocabulary)
            const isActive = () =>
              props.storage.activeVocabularyId === vocabulary.id

            return (
              <button
                type="button"
                class="min-h-[170px] border border-rule bg-transparent p-5 text-left font-serif-body text-ink transition hover:-translate-y-0.5 hover:border-accent hover:bg-paper-deep"
                classList={{ 'border-accent bg-paper-deep': isActive() }}
                onClick={() => props.onSelect(vocabulary.id)}
              >
                <span class="font-mono-editorial text-[11px] uppercase tracking-[0.18em] text-accent">
                  {vocabulary.words.length} слов
                </span>
                <p class="mt-8 break-words font-serif-display text-[40px] font-normal italic leading-none text-ink">
                  {vocabulary.name}
                </p>
                <small class="font-mono-editorial text-[12px] uppercase tracking-[0.12em] text-ink-faded">
                  освоено: {progress().completion}% · в работе:{' '}
                  {progress().inProgress}
                </small>
              </button>
            )
          }}
        </For>
      </div>
    </>
  )
}

function AdvancedSettingsModal(props: {
  settings: StorageShape['settings']
  onClose: () => void
  onSettingsChange: (patch: Partial<StorageShape['settings']>) => void
  onQuietHoursChange: (
    patch: Partial<StorageShape['settings']['quietHours']>,
  ) => void
}) {
  return (
    <div class="modal-backdrop">
      <button
        type="button"
        class="modal-backdrop-button"
        aria-label="Закрыть доп. настройки"
        onClick={props.onClose}
      />
      <section
        class="advanced-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-settings-title"
      >
        <div class="section-heading-row">
          <h2 id="advanced-settings-title" class="section-heading">
            Доп. настройки
          </h2>
          <button type="button" class="modal-close" onClick={props.onClose}>
            Закрыть
          </button>
        </div>
        <SettingsNumber
          label="Как часто"
          value={props.settings.frequency}
          min={1}
          max={20}
          suffix="действий"
          onChange={(frequency) => props.onSettingsChange({ frequency })}
        />
        <div class="settings-grid">
          <SettingsNumber
            label="Не показывать с"
            value={props.settings.quietHours.startHour}
            min={0}
            max={23}
            suffix="ч"
            onChange={(startHour) => props.onQuietHoursChange({ startHour })}
          />
          <SettingsNumber
            label="Не показывать до"
            value={props.settings.quietHours.endHour}
            min={0}
            max={23}
            suffix="ч"
            onChange={(endHour) => props.onQuietHoursChange({ endHour })}
          />
        </div>
      </section>
    </div>
  )
}

function SettingsNumber(props: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label class="settings-number">
      <span>{props.label}</span>
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) => {
          const value = Number(event.currentTarget.value)
          if (!Number.isNaN(value)) {
            props.onChange(Math.min(props.max, Math.max(props.min, value)))
          }
        }}
      />
      <small>{props.suffix}</small>
    </label>
  )
}

function buildActivityMonths(days: ActivityDay[]) {
  return days
    .filter((_, index) => index % 7 === 0)
    .map((day, index, weeks) => {
      const month = new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(
        dateFromKey(day.key),
      )
      if (index === 0) return month

      const previousMonth = new Intl.DateTimeFormat('ru-RU', {
        month: 'short',
      }).format(dateFromKey(weeks[index - 1]?.key ?? day.key))

      return month === previousMonth ? '' : month
    })
}

function buildActivityWeekdays() {
  return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
}

function buildActivityDays(state: StorageShape | undefined): ActivityDay[] {
  const history = new Map(
    (state?.userStats.dailyReviewHistory ?? []).map((entry) => [
      entry.date,
      entry,
    ]),
  )
  const today = startOfDay(Date.now())
  const todayWeekdayIndex = mondayWeekdayIndex(new Date(today))
  const totalDays = (HEATMAP_WEEKS - 1) * 7 + todayWeekdayIndex + 1

  return Array.from({ length: totalDays }, (_, index) => {
    const time = today - (totalDays - 1 - index) * DAY_MS
    const date = new Date(time)
    const key = dateKey(date)
    const entry = history.get(key)

    return {
      key,
      label: new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
      }).format(date),
      count: entry?.count ?? 0,
      correct: entry?.correct ?? 0,
      isToday: index === totalDays - 1,
    }
  })
}

function countWordsByMastery(
  vocabulary: Vocabulary | undefined,
  level: Exclude<MasteryFilter, 'all'>,
) {
  return (vocabulary?.words ?? []).filter((word) => masteryLevel(word) === level)
    .length
}

function getDictionaryWords(
  vocabulary: Vocabulary | undefined,
  filter: MasteryFilter,
) {
  return (vocabulary?.words ?? [])
    .filter((word) => filter === 'all' || masteryLevel(word) === filter)
    .sort((a, b) => {
      const rankDiff = masteryRank(a) - masteryRank(b)
      if (rankDiff !== 0) return rankDiff

      if (
        masteryLevel(a) === 'in-progress' &&
        masteryLevel(b) === 'in-progress'
      ) {
        return b.srs.repetition - a.srs.repetition
      }

      return a.sourceText.localeCompare(b.sourceText, 'ru')
    })
}

function getSelectedVocabulary(
  state: StorageShape | undefined,
  selectedVocabularyId: string | undefined,
) {
  if (!state || !selectedVocabularyId) return undefined
  return state.vocabularies.find(
    (vocabulary) => vocabulary.id === selectedVocabularyId,
  )
}

function vocabularyProgress(vocabulary: Vocabulary) {
  const mastered = countWordsByMastery(vocabulary, 'mastered')
  const inProgress = countWordsByMastery(vocabulary, 'in-progress')
  const total = vocabulary.words.length

  return {
    mastered,
    inProgress,
    completion: total === 0 ? 0 : Math.round((mastered / total) * 100),
  }
}

function masteryLevel(word: WordItem): Exclude<MasteryFilter, 'all'> {
  if (isMastered(word)) return 'mastered'
  if (word.srs.lastReviewedAt) return 'in-progress'
  return 'new'
}

function masteryRank(word: WordItem) {
  const level = masteryLevel(word)
  if (level === 'mastered') return 0
  if (level === 'in-progress') return 1
  return 2
}

function masteryLabel(word: WordItem) {
  const level = masteryLevel(word)
  if (level === 'mastered') return 'освоено'
  if (level === 'in-progress') return `в работе · ${word.srs.repetition}/3`
  return 'новое'
}

function isMastered(word: WordItem) {
  return word.srs.repetition >= 3 && word.srs.interval > 7
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mondayWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

function startOfDay(time: number) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

function isMasteryFilter(value: string): value is MasteryFilter {
  return ['all', 'mastered', 'in-progress', 'new'].includes(value)
}

function sendRuntimeMessage<TMessage extends RuntimeMessage>(
  message: TMessage,
): Promise<RuntimeResponseFor<TMessage>> {
  return chrome.runtime.sendMessage(message)
}

render(() => <Dashboard />, root)
