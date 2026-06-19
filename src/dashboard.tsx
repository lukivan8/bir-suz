import {
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'
import { calculateCurrentStreak } from './shared/challenge'
import type { RuntimeMessage, RuntimeResponseFor } from './shared/messages'
import type { StorageShape, Vocabulary, WordItem } from './shared/types'
import { normalizeStorageShape } from './shared/validation'

const DAY_MS = 24 * 60 * 60 * 1000
const HEATMAP_WEEKS = 13
const DASHBOARD_EXTENSION_HINT_DISMISSED_KEY = 'dashboardExtensionHintDismissed'
type MasteryFilter = 'all' | 'mastered' | 'in-progress' | 'new'
interface PendingDelete {
  vocabularyId: string
  wordId: string
  label: string
}
interface VocabularySettingsState {
  vocabularyId: string
}
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

  const state = normalizeStorageShape(response)
  if (!state) {
    throw new Error('Invalid storage state response')
  }

  return state
}

function Dashboard() {
  const [state, { mutate }] = createResource(getState)
  const [masteryFilter, setMasteryFilter] = createSignal<MasteryFilter>('all')
  const [selectedVocabularyId, setSelectedVocabularyId] = createSignal<string>()
  const [isAddVocabularyOpen, setIsAddVocabularyOpen] = createSignal(false)
  const [isAnalyticsWelcomeOpen, setIsAnalyticsWelcomeOpen] = createSignal(
    new URLSearchParams(window.location.search).get('welcome') === 'analytics',
  )
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)
  const [isExtensionHintOpen, setIsExtensionHintOpen] = createSignal(false)
  const [isAddWordOpen, setIsAddWordOpen] = createSignal(false)
  const [editingWordId, setEditingWordId] = createSignal<string>()
  const [pendingDelete, setPendingDelete] = createSignal<PendingDelete>()
  const [vocabularySettings, setVocabularySettings] =
    createSignal<VocabularySettingsState>()

  const activityDays = () => buildActivityDays(state())
  const activityMonths = () => buildActivityMonths(activityDays())
  const activityWeekdays = () => buildActivityWeekdays()
  const selectedVocabulary = () =>
    getSelectedVocabulary(state(), selectedVocabularyId())
  const dictionaryWords = () =>
    getDictionaryWords(selectedVocabulary(), masteryFilter())
  const currentStreak = () =>
    calculateCurrentStreak(state()?.userStats.dailyReviewHistory ?? [])

  const closeAnalyticsWelcome = () => {
    setIsAnalyticsWelcomeOpen(false)
    window.history.replaceState(null, '', 'dashboard.html')
  }

  onMount(() => {
    void chrome.storage.local
      .get(DASHBOARD_EXTENSION_HINT_DISMISSED_KEY)
      .then((stored) => {
        if (!stored[DASHBOARD_EXTENSION_HINT_DISMISSED_KEY]) {
          setIsExtensionHintOpen(true)
        }
      })
  })

  const dismissExtensionHint = () => {
    setIsExtensionHintOpen(false)
    void chrome.storage.local.set({
      [DASHBOARD_EXTENSION_HINT_DISMISSED_KEY]: true,
    })
  }

  const updateAnalyticsEnabled = async (analyticsEnabled: boolean) => {
    const current = state()
    if (!current) return

    const next = {
      ...current,
      settings: {
        ...current.settings,
        analyticsEnabled,
      },
    }

    mutate(next)
    await chrome.storage.local.set({ settings: next.settings })
  }

  const enableAnalytics = async () => {
    await updateAnalyticsEnabled(true)
    closeAnalyticsWelcome()
  }

  const addVocabulary = async (name: string) => {
    const current = state()
    const trimmedName = name.trim()
    if (!current || !trimmedName) return

    const now = Date.now()
    const vocabulary: Vocabulary = {
      id: `custom_vocabulary_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      category: 'custom',
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
      words: [],
    }
    const next = {
      ...current,
      vocabularies: [vocabulary, ...current.vocabularies],
      activeVocabularyId: vocabulary.id,
      activeVocabularyIds: [vocabulary.id],
    }

    mutate(next)
    setSelectedVocabularyId(vocabulary.id)
    setIsAddVocabularyOpen(false)
    await chrome.storage.local.set({
      vocabularies: next.vocabularies,
      activeVocabularyId: next.activeVocabularyId,
      activeVocabularyIds: next.activeVocabularyIds,
    })
  }

  const updateVocabularyWords = async (
    vocabularyId: string,
    updateWords: (words: WordItem[]) => WordItem[],
  ) => {
    const current = state()
    if (!current) return

    const now = Date.now()
    const next = {
      ...current,
      vocabularies: current.vocabularies.map((vocabulary) =>
        vocabulary.id === vocabularyId
          ? {
              ...vocabulary,
              updatedAt: now,
              words: updateWords(vocabulary.words),
            }
          : vocabulary,
      ),
    }

    mutate(next)
    await chrome.storage.local.set({ vocabularies: next.vocabularies })
  }

  const addWords = async (vocabularyId: string, words: WordItem[]) => {
    if (words.length === 0) return
    await updateVocabularyWords(vocabularyId, (currentWords) => [
      ...words,
      ...currentWords,
    ])
    setMasteryFilter('all')
  }

  const updateWord = async (
    vocabularyId: string,
    wordId: string,
    sourceText: string,
    targetText: string,
  ) => {
    await updateVocabularyWords(vocabularyId, (words) =>
      words.map((word) =>
        word.id === wordId
          ? {
              ...word,
              sourceText: sourceText.trim(),
              targetText: targetText.trim(),
            }
          : word,
      ),
    )
  }

  const deleteWord = async (vocabularyId: string, wordId: string) => {
    await updateVocabularyWords(vocabularyId, (words) =>
      words.filter((word) => word.id !== wordId),
    )
  }

  const saveWordEdit = async (
    vocabulary: Vocabulary,
    word: WordItem,
    sourceText: string,
    targetText: string,
  ) => {
    const nextSourceText = sourceText.trim()
    const nextTargetText = targetText.trim()
    if (!nextSourceText || !nextTargetText) return

    const duplicateSourceText = vocabulary.words.some(
      (candidate) =>
        candidate.id !== word.id &&
        normalizeSourceText(candidate.sourceText) ===
          normalizeSourceText(nextSourceText),
    )
    if (duplicateSourceText) return

    await updateWord(vocabulary.id, word.id, nextSourceText, nextTargetText)
    setEditingWordId(undefined)
  }

  const renameVocabulary = async (vocabularyId: string, name: string) => {
    const current = state()
    const trimmedName = name.trim()
    if (!current || !trimmedName) return

    const now = Date.now()
    const next = {
      ...current,
      vocabularies: current.vocabularies.map((vocabulary) =>
        vocabulary.id === vocabularyId
          ? { ...vocabulary, name: trimmedName, updatedAt: now }
          : vocabulary,
      ),
    }

    mutate(next)
    await chrome.storage.local.set({ vocabularies: next.vocabularies })
  }

  const deleteVocabulary = async (vocabularyId: string) => {
    const current = state()
    if (!current || current.vocabularies.length <= 1) return

    const nextVocabularies = current.vocabularies.filter(
      (vocabulary) => vocabulary.id !== vocabularyId,
    )
    const nextActiveVocabularyIds = current.activeVocabularyIds.filter(
      (id) => id !== vocabularyId,
    )
    if (nextActiveVocabularyIds.length === 0 && nextVocabularies[0]) {
      nextActiveVocabularyIds.push(nextVocabularies[0].id)
    }
    const nextActiveVocabularyId =
      nextActiveVocabularyIds[0] ?? current.activeVocabularyId
    const next = {
      ...current,
      vocabularies: nextVocabularies,
      activeVocabularyId: nextActiveVocabularyId,
      activeVocabularyIds: nextActiveVocabularyIds,
    }

    mutate(next)
    setSelectedVocabularyId(undefined)
    setVocabularySettings(undefined)
    await chrome.storage.local.set({
      vocabularies: next.vocabularies,
      activeVocabularyId: next.activeVocabularyId,
      activeVocabularyIds: next.activeVocabularyIds,
    })
  }

  const toggleVocabularyActive = async (vocabularyId: string) => {
    const current = state()
    if (!current) return

    const isActive = current.activeVocabularyIds.includes(vocabularyId)
    if (isActive && current.activeVocabularyIds.length === 1) return

    const activeVocabularyIds = isActive
      ? current.activeVocabularyIds.filter((id) => id !== vocabularyId)
      : [...current.activeVocabularyIds, vocabularyId]
    const next = {
      ...current,
      activeVocabularyId: activeVocabularyIds[0] ?? current.activeVocabularyId,
      activeVocabularyIds,
    }

    mutate(next)
    await chrome.storage.local.set({
      activeVocabularyId: next.activeVocabularyId,
      activeVocabularyIds: next.activeVocabularyIds,
    })
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
                  class="dashboard-settings-button"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  Настройки
                </button>
              </div>

              <Show when={isExtensionHintOpen()}>
                <aside
                  class="extension-return-hint"
                  aria-label="Как вернуться в Bir söz"
                >
                  <div class="extension-return-hint-icon" aria-hidden="true">
                    <svg viewBox="0 0 64 64">
                      <title>Значок расширений</title>
                      <path d="M17 12h14v9a7 7 0 1 0 14 0v-9h4a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6Zm14 18a3 3 0 1 1 6 0v5h-6v-5Z" />
                    </svg>
                  </div>
                  <p>
                    Управляйте расширением и возвращайтесь сюда в любой момент:
                    нажмите значок расширений в панели браузера, затем{' '}
                    <em class="extension-return-hint-name">Bir söz</em>.
                  </p>
                  <button
                    type="button"
                    class="extension-return-hint-dismiss"
                    aria-label="Скрыть подсказку"
                    onClick={dismissExtensionHint}
                  >
                    ×
                  </button>
                </aside>
              </Show>

              <Show when={isAnalyticsWelcomeOpen()}>
                <AnalyticsWelcomeModal
                  onSkip={closeAnalyticsWelcome}
                  onEnable={enableAnalytics}
                />
              </Show>
              <Show when={isSettingsOpen()}>
                <DashboardSettingsModal
                  analyticsEnabled={current().settings.analyticsEnabled}
                  onAnalyticsChange={updateAnalyticsEnabled}
                  onClose={() => setIsSettingsOpen(false)}
                />
              </Show>

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
                    <>
                      <VocabularyOverview
                        storage={current()}
                        onAdd={() => setIsAddVocabularyOpen(true)}
                        onSelect={(vocabularyId) => {
                          setSelectedVocabularyId(vocabularyId)
                          setMasteryFilter('all')
                        }}
                        onToggleActive={toggleVocabularyActive}
                      />
                      <Show when={isAddVocabularyOpen()}>
                        <AddVocabularyModal
                          onClose={() => setIsAddVocabularyOpen(false)}
                          onAdd={addVocabulary}
                        />
                      </Show>
                    </>
                  }
                >
                  {(vocabulary) => (
                    <>
                      <div class="section-heading-row">
                        <div class="vocabulary-heading-with-action">
                          <h2 class="section-heading">{vocabulary().name}</h2>
                          <button
                            type="button"
                            aria-label="Редактировать словарь"
                            title="Редактировать словарь"
                            onClick={() =>
                              setVocabularySettings({
                                vocabularyId: vocabulary().id,
                              })
                            }
                          >
                            ✎
                          </button>
                        </div>
                        <div class="table-tools vocabulary-title-actions">
                          <span>{dictionaryWords().length} слов</span>
                          <button
                            type="button"
                            onClick={() => setSelectedVocabularyId(undefined)}
                          >
                            ← Все словари
                          </button>
                          <DashboardSwitch
                            label="Активен в заданиях"
                            checked={current().activeVocabularyIds.includes(
                              vocabulary().id,
                            )}
                            onChange={() =>
                              toggleVocabularyActive(vocabulary().id)
                            }
                          />
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
                      <div class="dictionary-actions">
                        <button
                          type="button"
                          onClick={() => setIsAddWordOpen(true)}
                        >
                          + Добавить слово
                        </button>
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
                              <button
                                type="button"
                                class="mastered-row mastered-row-button"
                                onClick={() => setEditingWordId(word.id)}
                              >
                                <span>{word.sourceText}</span>
                                <em>{word.targetText}</em>
                                <span>{masteryLabel(word)}</span>
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
                      <Show when={isAddWordOpen()}>
                        <AddWordModal
                          vocabularyName={vocabulary().name}
                          existingWords={vocabulary().words}
                          onClose={() => setIsAddWordOpen(false)}
                          onAdd={(words) => addWords(vocabulary().id, words)}
                        />
                      </Show>
                      <Show
                        when={vocabulary().words.find(
                          (word) => word.id === editingWordId(),
                        )}
                      >
                        {(word) => (
                          <EditWordModal
                            word={word()}
                            onClose={() => setEditingWordId(undefined)}
                            onSave={(sourceText, targetText) =>
                              saveWordEdit(
                                vocabulary(),
                                word(),
                                sourceText,
                                targetText,
                              )
                            }
                            onDelete={() => {
                              setPendingDelete({
                                vocabularyId: vocabulary().id,
                                wordId: word().id,
                                label: `${word().sourceText} — ${word().targetText}`,
                              })
                              setEditingWordId(undefined)
                            }}
                          />
                        )}
                      </Show>
                      <Show when={pendingDelete()}>
                        {(deleteRequest) => (
                          <ConfirmDeleteModal
                            label={deleteRequest().label}
                            onCancel={() => setPendingDelete(undefined)}
                            onConfirm={async () => {
                              await deleteWord(
                                deleteRequest().vocabularyId,
                                deleteRequest().wordId,
                              )
                              setPendingDelete(undefined)
                            }}
                          />
                        )}
                      </Show>
                      <Show when={vocabularySettings()}>
                        {(settings) => (
                          <VocabularySettingsModal
                            vocabulary={vocabulary()}
                            canDelete={current().vocabularies.length > 1}
                            onClose={() => setVocabularySettings(undefined)}
                            onRename={async (name) => {
                              await renameVocabulary(
                                settings().vocabularyId,
                                name,
                              )
                              setVocabularySettings(undefined)
                            }}
                            onDelete={() =>
                              deleteVocabulary(settings().vocabularyId)
                            }
                          />
                        )}
                      </Show>
                    </>
                  )}
                </Show>
              </section>
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

function AnalyticsWelcomeModal(props: {
  onSkip: () => void
  onEnable: () => void | Promise<void>
}) {
  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="advanced-modal word-modal analytics-welcome-modal">
        <h2 class="section-heading">Статистика помогает Bir Söz расти</h2>
        <p class="modal-note">
          Наша миссия — создавать языковую среду для людей, которые изучают
          казахский. Обезличенная статистика помогает понимать, какие задания
          действительно поддерживают эту среду: показы, ответы, пропуски, время
          ответа и прогресс по встроенным словам.
        </p>
        <p class="modal-note">
          Мы не отправляем адреса страниц, содержимое сайтов, формы, пароли,
          cookies, историю браузера, клики или ваши личные слова. Статистика
          связана только со случайным идентификатором установки и не указывает
          на конкретного пользователя.
        </p>
        <div class="modal-actions">
          <button type="button" onClick={props.onSkip}>
            Не включать
          </button>
          <button type="button" onClick={props.onEnable}>
            Включить статистику
          </button>
        </div>
      </div>
    </div>
  )
}

function DashboardSettingsModal(props: {
  analyticsEnabled: boolean
  onAnalyticsChange: (analyticsEnabled: boolean) => void | Promise<void>
  onClose: () => void
}) {
  useEscapeKey(props.onClose)

  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <button
        type="button"
        class="modal-backdrop-button"
        aria-label="Закрыть"
        onClick={props.onClose}
      />
      <div class="advanced-modal word-modal dashboard-settings-modal">
        <button type="button" class="modal-close" onClick={props.onClose}>
          закрыть
        </button>
        <h2 class="section-heading">Настройки</h2>
        <div class="settings-toggle-row">
          <div>
            <span>Статистика использования</span>
            <p>
              Отправляет техническую статистику обучения без адресов страниц и
              содержимого сайтов.
            </p>
          </div>
          <DashboardSwitch
            label="Статистика использования"
            checked={props.analyticsEnabled}
            onChange={props.onAnalyticsChange}
          />
        </div>
      </div>
    </div>
  )
}

function DashboardSwitch(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void | Promise<void>
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={`${props.label}: ${props.checked ? 'включено' : 'выключено'}`}
      class="dashboard-switch"
      classList={{ checked: props.checked }}
      onClick={() => props.onChange(!props.checked)}
    >
      <span />
    </button>
  )
}

function EditWordModal(props: {
  word: WordItem
  onClose: () => void
  onSave: (sourceText: string, targetText: string) => void | Promise<void>
  onDelete: () => void
}) {
  useEscapeKey(props.onClose)
  const [sourceText, setSourceText] = createSignal(props.word.sourceText)
  const [targetText, setTargetText] = createSignal(props.word.targetText)
  const canSave = () => sourceText().trim() && targetText().trim()

  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <button
        type="button"
        class="modal-backdrop-button"
        aria-label="Закрыть"
        onClick={props.onClose}
      />
      <div class="advanced-modal word-modal">
        <button type="button" class="modal-close" onClick={props.onClose}>
          закрыть
        </button>
        <h2 class="section-heading">Редактировать слово</h2>
        <label class="word-field">
          Казахское слово
          <input
            value={sourceText()}
            onInput={(event) => setSourceText(event.currentTarget.value)}
          />
        </label>
        <label class="word-field">
          Русский перевод
          <input
            value={targetText()}
            onInput={(event) => setTargetText(event.currentTarget.value)}
          />
        </label>
        <div class="modal-actions">
          <button type="button" class="danger-link" onClick={props.onDelete}>
            Удалить слово
          </button>
          <button
            type="button"
            disabled={!canSave()}
            onClick={() => props.onSave(sourceText(), targetText())}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal(props: {
  label: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  useEscapeKey(props.onCancel)
  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <button
        type="button"
        class="modal-backdrop-button"
        aria-label="Отмена"
        onClick={props.onCancel}
      />
      <div class="advanced-modal word-modal">
        <h2 class="section-heading">Удалить слово?</h2>
        <p class="modal-note">
          Слово «{props.label}» будет удалено из словаря.
        </p>
        <div class="modal-actions">
          <button type="button" onClick={props.onCancel}>
            Отмена
          </button>
          <button type="button" onClick={props.onConfirm}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  )
}

function AddVocabularyModal(props: {
  onClose: () => void
  onAdd: (name: string) => void | Promise<void>
}) {
  useEscapeKey(props.onClose)
  const [name, setName] = createSignal('')
  const canAdd = () => Boolean(name().trim())

  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <button
        type="button"
        class="modal-backdrop-button"
        aria-label="Закрыть"
        onClick={props.onClose}
      />
      <form
        class="advanced-modal word-modal"
        onSubmit={(event) => {
          event.preventDefault()
          if (canAdd()) void props.onAdd(name())
        }}
      >
        <button type="button" class="modal-close" onClick={props.onClose}>
          закрыть
        </button>
        <h2 class="section-heading">Новый словарь</h2>
        <label class="word-field">
          Название словаря
          <input
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            placeholder="Мой словарь"
            required
          />
        </label>
        <div class="modal-actions">
          <span />
          <button type="submit" disabled={!canAdd()}>
            Создать
          </button>
        </div>
      </form>
    </div>
  )
}

function VocabularySettingsModal(props: {
  vocabulary: Vocabulary
  canDelete: boolean
  onClose: () => void
  onRename: (name: string) => void | Promise<void>
  onDelete: () => void | Promise<void>
}) {
  useEscapeKey(props.onClose)
  const [name, setName] = createSignal(props.vocabulary.name)
  const [isDeleteConfirming, setIsDeleteConfirming] = createSignal(false)
  const [deleteConfirmation, setDeleteConfirmation] = createSignal('')
  const canRename = () =>
    name().trim() && name().trim() !== props.vocabulary.name
  const canDelete = () =>
    props.canDelete && deleteConfirmation().trim() === props.vocabulary.name

  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <button
        type="button"
        class="modal-backdrop-button"
        aria-label="Закрыть"
        onClick={props.onClose}
      />
      <div class="advanced-modal word-modal">
        <button type="button" class="modal-close" onClick={props.onClose}>
          закрыть
        </button>
        <h2 class="section-heading">Настройки словаря</h2>
        <label class="word-field">
          Название словаря
          <input
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div class="modal-actions">
          <span />
          <button
            type="button"
            disabled={!canRename()}
            onClick={() => props.onRename(name())}
          >
            Сохранить название
          </button>
        </div>
        <div class="danger-zone">
          <Show
            when={isDeleteConfirming()}
            fallback={
              <button
                type="button"
                class="danger-button"
                disabled={!props.canDelete}
                onClick={() => setIsDeleteConfirming(true)}
              >
                {props.canDelete
                  ? 'Удалить словарь'
                  : 'Нельзя удалить последний словарь'}
              </button>
            }
          >
            <p class="modal-note">
              Чтобы удалить словарь, введи его текущее название: «
              {props.vocabulary.name}».
            </p>
            <input
              value={deleteConfirmation()}
              onInput={(event) =>
                setDeleteConfirmation(event.currentTarget.value)
              }
              placeholder={props.vocabulary.name}
            />
            <div class="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirming(false)
                  setDeleteConfirmation('')
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!canDelete()}
                onClick={props.onDelete}
              >
                Подтвердить удаление
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

function AddWordModal(props: {
  vocabularyName: string
  existingWords: WordItem[]
  onClose: () => void
  onAdd: (words: WordItem[]) => Promise<void>
}) {
  useEscapeKey(props.onClose)
  const [kazakhWord, setKazakhWord] = createSignal('')
  const [russianWord, setRussianWord] = createSignal('')
  const [isSaving, setIsSaving] = createSignal(false)
  const [error, setError] = createSignal('')

  const createAndAddWords = async (pairs: Array<[string, string]>) => {
    const words = pairs
      .map(([sourceText, targetText]) => createWordItem(sourceText, targetText))
      .filter((word): word is WordItem => Boolean(word))

    if (words.length === 0) {
      setError('Добавь казахское и русское слово.')
      return
    }

    const uniqueWords = filterUniqueSourceWords(words, props.existingWords)

    setIsSaving(true)
    setError('')
    if (uniqueWords.length > 0) {
      await props.onAdd(uniqueWords)
    }
    setIsSaving(false)
    props.onClose()
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    await createAndAddWords([[kazakhWord(), russianWord()]])
  }

  const uploadCsv = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const rows = parseWordCsv(await file.text())
    await createAndAddWords(rows)
    input.value = ''
  }

  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <button
        type="button"
        class="modal-backdrop-button"
        aria-label="Закрыть"
        onClick={props.onClose}
      />
      <form class="advanced-modal word-modal" onSubmit={submit}>
        <button type="button" class="modal-close" onClick={props.onClose}>
          закрыть
        </button>
        <h2 class="section-heading">Новое слово</h2>
        <p class="modal-note">
          Добавится в «{props.vocabularyName}». Казахское слово можно вводить
          кириллицей или латиницей.
        </p>
        <label class="word-field">
          Казахское слово
          <input
            value={kazakhWord()}
            onInput={(event) => setKazakhWord(event.currentTarget.value)}
            placeholder="кітап / kitap"
            required
          />
        </label>
        <label class="word-field">
          Русский перевод
          <input
            value={russianWord()}
            onInput={(event) => setRussianWord(event.currentTarget.value)}
            placeholder="книга"
            required
          />
        </label>
        <Show when={error()}>
          <p class="form-error">{error()}</p>
        </Show>
        <div class="modal-actions">
          <label class="csv-upload-button">
            импортировать csv
            <input type="file" accept=".csv,text/csv" onChange={uploadCsv} />
          </label>
          <button type="submit" disabled={isSaving()}>
            {isSaving() ? 'Сохраняем…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}

function VocabularyOverview(props: {
  storage: StorageShape
  onAdd: () => void
  onSelect: (vocabularyId: string) => void
  onToggleActive: (vocabularyId: string) => void | Promise<void>
}) {
  return (
    <>
      <div class="section-heading-row">
        <h2 class="section-heading">
          Все словари, <em>выбери набор</em>.
        </h2>
        <div class="overview-actions">
          <button type="button" onClick={props.onAdd}>
            + Добавить словарь
          </button>
          <span class="table-count">
            {props.storage.vocabularies.length} словаря
          </span>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-6 max-[760px]:grid-cols-1">
        <For each={props.storage.vocabularies}>
          {(vocabulary) => {
            const progress = () => vocabularyProgress(vocabulary)
            const isActive = () =>
              props.storage.activeVocabularyIds.includes(vocabulary.id)

            return (
              <article
                class={`flex min-h-[170px] flex-col justify-between border p-5 text-left font-serif-body text-ink transition hover:-translate-y-0.5 hover:border-accent hover:bg-paper-deep ${
                  isActive()
                    ? 'border-accent bg-paper-deep shadow-[inset_4px_0_0_var(--accent)]'
                    : 'border-rule bg-transparent'
                }`}
              >
                <div class="flex items-center justify-between gap-3 font-mono-editorial text-[11px] uppercase tracking-[0.18em]">
                  <span class="text-accent">
                    {vocabulary.words.length} слов
                  </span>
                  <DashboardSwitch
                    label={`${vocabulary.name}: активен в заданиях`}
                    checked={isActive()}
                    onChange={() => props.onToggleActive(vocabulary.id)}
                  />
                </div>
                <button
                  type="button"
                  class="mt-6 text-left"
                  onClick={() => props.onSelect(vocabulary.id)}
                >
                  <p class="truncate font-serif-display text-2xl font-normal italic leading-none text-ink">
                    {vocabulary.name}
                  </p>
                  <small class="mt-6 block font-mono-editorial text-[12px] uppercase tracking-[0.12em] text-ink-faded">
                    освоено: {progress().completion}% · в работе:{' '}
                    {progress().inProgress}
                  </small>
                </button>
              </article>
            )
          }}
        </For>
      </div>
    </>
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
  return (vocabulary?.words ?? []).filter(
    (word) => masteryLevel(word) === level,
  ).length
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

function createWordItem(
  sourceText: string,
  targetText: string,
): WordItem | undefined {
  const cleanSourceText = sourceText.trim()
  const cleanTargetText = targetText.trim()
  if (!cleanSourceText || !cleanTargetText) return undefined

  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sourceText: cleanSourceText,
    targetText: cleanTargetText,
    sourceLabel: 'qazaq tili',
    targetLabel: 'orys tili',
    level: 'A1',
    srs: {
      repetition: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReview: 0,
    },
  }
}

function parseWordCsv(text: string): Array<[string, string]> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sourceText = '', targetText = ''] = line
        .split(/[,;]/)
        .map((cell) => cell.trim().replace(/^"|"$/g, ''))
      return [sourceText, targetText] as [string, string]
    })
    .filter(([sourceText, targetText]) => sourceText && targetText)
}

function filterUniqueSourceWords(
  newWords: WordItem[],
  existingWords: WordItem[],
): WordItem[] {
  const seen = new Set(
    existingWords.map((word) => normalizeSourceText(word.sourceText)),
  )

  return newWords.filter((word) => {
    const normalizedSourceText = normalizeSourceText(word.sourceText)
    if (seen.has(normalizedSourceText)) return false
    seen.add(normalizedSourceText)
    return true
  })
}

function normalizeSourceText(text: string) {
  return text.trim().toLocaleLowerCase('kk-KZ')
}

function useEscapeKey(onEscape: () => void) {
  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape()
    }

    document.addEventListener('keydown', handleKeyDown)
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown))
  })
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
