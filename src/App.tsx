import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from 'solid-js'
import type { RuntimeMessage, RuntimeResponseFor } from './shared/messages'
import type { AppSettings } from './shared/types'
import { normalizeStorageShape } from './shared/validation'

const MULTIPLE_VOCABULARIES_VALUE = '__multiple_vocabularies__'

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

function App() {
  const [state, { mutate, refetch }] = createResource(getState)
  const [busy, setBusy] = createSignal(false)
  const [demoMessage, setDemoMessage] = createSignal<string>()
  const [now, setNow] = createSignal(Date.now())
  const [doNotDisturbMinutes, setDoNotDisturbMinutes] = createSignal(30)

  const updateSettings = async (patch: Partial<AppSettings>) => {
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

  const updateActiveVocabulary = async (activeVocabularyId: string) => {
    const current = state()
    if (!current || activeVocabularyId === MULTIPLE_VOCABULARIES_VALUE) return

    const next = {
      ...current,
      activeVocabularyId,
      activeVocabularyIds: [activeVocabularyId],
    }

    mutate(next)
    await chrome.storage.local.set({
      activeVocabularyId,
      activeVocabularyIds: [activeVocabularyId],
    })
  }

  const toggleDoNotDisturb = async (enabled: boolean) => {
    await updateSettings({
      disabledUntil: enabled
        ? Date.now() + doNotDisturbMinutes() * 60 * 1000
        : undefined,
    })
    void sendRuntimeMessage({
      type: 'bir-soz:stats-event',
      eventType: enabled ? 'disabled' : 'enabled',
    })
    await refetch()
  }

  const triggerOffRemainingMs = () =>
    Math.max(0, (state()?.settings.disabledUntil ?? 0) - now())

  const isDoNotDisturbOn = () => triggerOffRemainingMs() > 0

  createEffect(() => {
    const timer = window.setInterval(async () => {
      const nextNow = Date.now()
      setNow(nextNow)

      const current = state()
      if (
        current?.settings.disabledUntil &&
        current.settings.disabledUntil <= nextNow
      ) {
        await updateSettings({ disabledUntil: undefined })
      }
    }, 1000)

    onCleanup(() => window.clearInterval(timer))
  })

  const triggerDemo = async () => {
    setBusy(true)
    setDemoMessage(undefined)
    const response = await sendRuntimeMessage({ type: 'bir-soz:force-trigger' })
    if (!response.triggered) {
      setDemoMessage(t().demoNeedsPage)
    }
    await refetch()
    setBusy(false)
  }

  const successRate = () => {
    const current = state()
    if (!current || current.userStats.totalExposures === 0) return 0
    return Math.round(
      (current.userStats.totalCorrect / current.userStats.totalExposures) * 100,
    )
  }

  const t = () => copy.ru

  return (
    <main class="min-w-80 space-y-4 bg-paper p-5 font-serif-body text-[17px] leading-[1.55] text-ink">
      <header>
        <h1 class="font-mono-editorial text-[11px] uppercase tracking-[0.2em] text-accent">
          Bir söz
        </h1>
      </header>

      <Show when={state()}>
        {(current) => (
          <>
            <section class="space-y-1 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
              <div class="flex gap-4">
                <span>
                  {t().exposure}: {current().userStats.totalExposures}
                </span>
                <span>
                  {t().success}: {successRate()}%
                </span>
              </div>
            </section>

            <section class="space-y-3 border border-rule bg-paper-deep p-3">
              <p class="font-mono-editorial text-[11px] font-normal uppercase tracking-[0.18em] text-ink-faded">
                {t().settings}
              </p>
              <RangeField
                label={t().cooldown}
                value={current().settings.cooldownMinutes}
                min={0}
                max={15}
                suffix={t().min}
                onChange={(value) => updateSettings({ cooldownMinutes: value })}
              />
              <div class="grid gap-2 text-[15px]">
                <span>{t().quietHours}</span>
                <div class="flex items-center gap-3">
                  <Show
                    when={isDoNotDisturbOn()}
                    fallback={
                      <select
                        class="h-[35px] min-w-0 flex-1 border border-rule bg-paper px-3 font-serif-body text-[15px] text-ink"
                        value={doNotDisturbMinutes()}
                        onChange={(event) =>
                          setDoNotDisturbMinutes(
                            Number(event.currentTarget.value),
                          )
                        }
                      >
                        <option value="30">30 {t().min}</option>
                        <option value="60">1 час</option>
                        <option value="120">2 часа</option>
                        <option value="240">4 часа</option>
                        <option value="480">8 часов</option>
                      </select>
                    }
                  >
                    <p class="flex h-[35px] min-w-0 flex-1 items-center border border-rule bg-paper px-3 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
                      {t().doNotDisturbActive} ·{' '}
                      {formatRemaining(triggerOffRemainingMs())}
                    </p>
                  </Show>
                  <Switch
                    label={t().quietHours}
                    checked={isDoNotDisturbOn()}
                    onChange={toggleDoNotDisturb}
                  />
                </div>
              </div>
              <label class="grid gap-2 text-[15px]">
                <span>{t().vocabulary}</span>
                <select
                  class="w-full border border-rule bg-paper px-3 py-2 font-serif-body text-[15px] text-ink"
                  value={activeVocabularyValue(current())}
                  onChange={(event) =>
                    updateActiveVocabulary(event.currentTarget.value)
                  }
                >
                  <Show when={current().activeVocabularyIds.length > 1}>
                    <option value={MULTIPLE_VOCABULARIES_VALUE} disabled>
                      Выбрано несколько
                    </option>
                  </Show>
                  <For each={current().vocabularies}>
                    {(vocabulary) => (
                      <option value={vocabulary.id}>{vocabulary.name}</option>
                    )}
                  </For>
                </select>
              </label>
            </section>

            <section class="grid gap-2">
              <a
                class="border border-accent bg-transparent px-4 py-3 text-center font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-accent hover:text-accent-deep"
                href="dashboard.html"
                target="_blank"
                rel="noopener"
              >
                {t().openDashboard}
              </a>
              <button
                type="button"
                class="border border-rule bg-transparent px-4 py-3 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded hover:text-ink disabled:opacity-60"
                onClick={triggerDemo}
                disabled={busy()}
              >
                {busy() ? t().triggering : t().demoTrigger}
              </button>
              <Show when={demoMessage()}>
                {(message) => (
                  <p class="border border-rule bg-paper-deep px-3 py-2 text-[14px] leading-snug text-ink-faded">
                    {message()}
                  </p>
                )}
              </Show>
            </section>
          </>
        )}
      </Show>
    </main>
  )
}

const copy = {
  ru: {
    exposure: 'Заданий',
    success: 'Верно',
    vocabulary: 'Словарь',
    settings: 'Настройки',
    cooldown: 'Между заданиями',
    min: 'мин',
    quietHours: 'Не беспокоить',
    doNotDisturbActive: 'Осталось',
    triggering: 'Показываем…',
    demoTrigger: 'Показать пример',
    demoNeedsPage:
      'Откройте или обновите обычную страницу сайта, затем попробуйте снова.',
    openDashboard: 'Мой прогресс',
  },
} as const

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function activeVocabularyValue(state: { activeVocabularyIds: string[] }) {
  return state.activeVocabularyIds.length > 1
    ? MULTIPLE_VOCABULARIES_VALUE
    : state.activeVocabularyIds[0]
}

function Switch(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={`${props.label}: ${props.checked ? 'включено' : 'выключено'}`}
      class="relative h-[35px] w-14 shrink-0 border border-rule bg-paper text-left transition-colors hover:border-accent aria-checked:border-accent aria-checked:bg-accent"
      onClick={() => props.onChange(!props.checked)}
    >
      <span
        class="absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 bg-ink-faded transition-transform"
        classList={{
          'translate-x-7 bg-paper': props.checked,
        }}
      />
      <span class="sr-only">{props.checked ? 'Вкл' : 'Выкл'}</span>
    </button>
  )
}

function RangeField(props: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label class="grid gap-2 text-[15px]">
      <span class="flex items-center justify-between gap-3">
        <span>{props.label}</span>
        <span class="font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
          {props.value} {props.suffix}
        </span>
      </span>
      <input
        class="accent-accent"
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onInput={(event) => props.onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

function sendRuntimeMessage<TMessage extends RuntimeMessage>(
  message: TMessage,
): Promise<RuntimeResponseFor<TMessage>> {
  return chrome.runtime.sendMessage(message)
}

export default App
