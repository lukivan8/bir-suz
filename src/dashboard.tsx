import { createResource, createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'
import { calculateCurrentStreak } from './shared/challenge'
import type { RuntimeMessage } from './shared/messages'
import type { StorageShape, WordItem } from './shared/types'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

async function getState() {
  return (await sendRuntimeMessage({
    type: 'bir-soz:get-state',
  })) as StorageShape
}

function Dashboard() {
  const [state, { mutate }] = createResource(getState)
  const [advancedOpen, setAdvancedOpen] = createSignal(false)

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

  const week = () => buildWeek(state())
  const masteredWords = () => getMasteredWords(state())
  const activeWords = () => getActiveWords(state())
  const weekTotal = () => week().reduce((sum, day) => sum + day.count, 0)
  const weekAverage = () => (weekTotal() / 7).toFixed(1)
  const maxCount = () => Math.max(1, ...week().map((day) => day.count))
  const currentStreak = () =>
    calculateCurrentStreak(state()?.userStats.dailyReviewHistory ?? [])

  return (
    <main class="dashboard-page">
      <div class="dashboard-shell">
        <header class="memo-header">
          <MemoCell label="Документ" value="Прогресс" />
          <MemoCell label="Расширение" value="Бір сөз" />
          <MemoCell label="Обновлено" value={formatToday()} />
        </header>

        <Show when={state()}>
          {(current) => (
            <>
              <section class="dashboard-section">
                <span class="section-num">01 — Серия</span>
                <h1 class="section-heading">Ритм, который держится.</h1>
                <div class="streak-grid">
                  <StatBlock
                    label="Дней подряд"
                    value={currentStreak()}
                    unit="дней"
                    faded={currentStreak() === 0}
                  />
                  <StatBlock
                    label="Лучшая серия"
                    value={current().userStats.bestStreak}
                    unit="дней"
                  />
                  <StatBlock
                    label="Всего заданий"
                    value={current().userStats.totalExposures}
                    unit="задач"
                  />
                </div>
                <div class="streak-row">
                  <For each={week()}>
                    {(day) => (
                      <div class="streak-day">
                        <div
                          class="streak-square"
                          classList={{
                            active: day.count > 0,
                            today: day.isToday,
                          }}
                        />
                        <span>{day.label}</span>
                      </div>
                    )}
                  </For>
                </div>
              </section>

              <section class="dashboard-section">
                <span class="section-num">02 — Прогресс за неделю</span>
                <h2 class="section-heading">
                  7 дней, <em>каждая задача</em>.
                </h2>
                <div class="graph-box">
                  <div class="bars">
                    <For each={week()}>
                      {(day) => (
                        <div class="bar-col">
                          <div class="bar-wrap">
                            <div
                              class="bar"
                              classList={{ empty: day.count === 0 }}
                              style={{
                                height: `${day.count === 0 ? 2 : Math.max(8, (day.count / maxCount()) * 80)}px`,
                              }}
                            />
                          </div>
                          <span class="bar-day">{day.label}</span>
                          <span class="bar-count">{day.count}</span>
                        </div>
                      )}
                    </For>
                  </div>
                  <aside class="graph-notes">
                    <p>Всего за неделю: {weekTotal()} задач</p>
                    <p>Среднее в день: {weekAverage()}</p>
                  </aside>
                </div>
              </section>

              <section class="dashboard-section">
                <span class="section-num">03 — Словарь</span>
                <h2 class="section-heading">Словарь в работе.</h2>
                <div class="vocab-grid">
                  <MetricPanel
                    label="Активный словарь"
                    value={activeWords().length}
                    body="слов сейчас повторяются"
                    note="активный: уже встречался, ещё не освоен"
                  />
                  <MetricPanel
                    label="Освоенные слова"
                    value={masteredWords().length}
                    body="слов узнаёшь без подсказки"
                    note="освоенное: верно 3 раза подряд, повтор реже недели"
                    accent
                  />
                </div>
              </section>

              <section class="dashboard-section">
                <span class="section-num">04 — Освоено</span>
                <div class="section-heading-row">
                  <h2 class="section-heading">
                    Слова, <em>которые остались</em>.
                  </h2>
                  <span class="table-count">{masteredWords().length} слов</span>
                </div>
                <div class="table-tools">
                  <button type="button">Сначала новые</button>
                  <button type="button" onClick={() => setAdvancedOpen(true)}>
                    Доп. настройки
                  </button>
                </div>
                <Show
                  when={masteredWords().length > 0}
                  fallback={
                    <div class="empty-state">
                      Ещё ни одного. <em>Скоро будут.</em>
                    </div>
                  }
                >
                  <div class="mastered-table">
                    <For each={masteredWords()}>
                      {(word) => (
                        <div class="mastered-row">
                          <span>{word.sourceText}</span>
                          <em>{word.targetText}</em>
                          <span>повтор через {word.srs.interval} дней</span>
                        </div>
                      )}
                    </For>
                  </div>
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

        <footer class="dashboard-footer">
          <span>Бір сөз · Прогресс</span>
          <span>v0.1 · локально</span>
        </footer>
      </div>
    </main>
  )
}

function MemoCell(props: { label: string; value: string }) {
  return (
    <div class="memo-cell">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
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

function AdvancedSettingsModal(props: {
  settings: StorageShape['settings']
  onClose: () => void
  onSettingsChange: (patch: Partial<StorageShape['settings']>) => void
  onQuietHoursChange: (
    patch: Partial<StorageShape['settings']['quietHours']>,
  ) => void
}) {
  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="advanced-modal" onClick={(event) => event.stopPropagation()}>
        <div class="section-heading-row">
          <h2 class="section-heading">Доп. настройки</h2>
          <button type="button" class="modal-close" onClick={props.onClose}>
            Закрыть
          </button>
        </div>
        <label class="settings-number">
          <span>Язык интерфейса</span>
          <select
            value={props.settings.uiLanguage}
            onChange={(event) =>
              props.onSettingsChange({ uiLanguage: event.currentTarget.value as 'ru' | 'en' })
            }
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
          <small>язык меню</small>
        </label>
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
      </div>
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

function buildWeek(state: StorageShape | undefined) {
  const history = new Map(
    (state?.userStats.dailyReviewHistory ?? []).map((entry) => [
      entry.date,
      entry.count,
    ]),
  )
  const today = startOfDay(Date.now())

  return Array.from({ length: 7 }, (_, index) => {
    const time = today - (6 - index) * DAY_MS
    const date = new Date(time)
    const key = dateKey(date)
    return {
      key,
      label: DAY_LABELS[date.getDay()],
      count: history.get(key) ?? 0,
      isToday: index === 6,
    }
  })
}

function getMasteredWords(state: StorageShape | undefined) {
  return (state?.wordBank ?? [])
    .filter(isMastered)
    .sort((a, b) => (b.srs.lastReviewedAt ?? 0) - (a.srs.lastReviewedAt ?? 0))
}

function getActiveWords(state: StorageShape | undefined) {
  return (state?.wordBank ?? []).filter(
    (word) => word.srs.lastReviewedAt && !isMastered(word),
  )
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

function startOfDay(time: number) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function formatToday() {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

function sendRuntimeMessage(message: RuntimeMessage) {
  return chrome.runtime.sendMessage(message)
}

render(() => <Dashboard />, root)
