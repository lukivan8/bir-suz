import { createEffect, createResource, createSignal, onCleanup, Show } from 'solid-js'
import type { RuntimeMessage } from './shared/messages'
import type { AppSettings, StorageShape } from './shared/types'

async function getState() {
  return (await sendRuntimeMessage({
    type: 'bir-soz:get-state',
  })) as StorageShape
}

function App() {
  const [state, { mutate, refetch }] = createResource(getState)
  const [busy, setBusy] = createSignal(false)
  const [now, setNow] = createSignal(Date.now())

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

  const updateQuietHours = async (
    patch: Partial<AppSettings['quietHours']>,
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

  const toggleTriggersOff = async () => {
    const current = state()
    if (!current) return
    const isOff = (current.settings.disabledUntil ?? 0) > Date.now()
    await updateSettings({ disabledUntil: isOff ? undefined : Date.now() + 30 * 60 * 1000 })
    await refetch()
  }

  const triggerOffRemainingMs = () =>
    Math.max(0, (state()?.settings.disabledUntil ?? 0) - now())

  const triggerOffLabel = () => {
    const totalSeconds = Math.ceil(triggerOffRemainingMs() / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  createEffect(() => {
    const timer = window.setInterval(async () => {
      const nextNow = Date.now()
      setNow(nextNow)

      const current = state()
      if (current?.settings.disabledUntil && current.settings.disabledUntil <= nextNow) {
        await updateSettings({ disabledUntil: undefined })
      }
    }, 1000)

    onCleanup(() => window.clearInterval(timer))
  })

  const triggerDemo = async () => {
    setBusy(true)
    await sendRuntimeMessage({ type: 'bir-soz:force-trigger' })
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
          Bir sóz
        </h1>
      </header>

      <Show when={state()}>
        {(current) => (
          <>
            <section class="flex gap-4 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
              <span>
                {t().exposure}: {current().userStats.totalExposures}
              </span>
              <span>
                {t().success}: {successRate()}%
              </span>
            </section>

            <section class="space-y-3 border border-rule bg-paper-deep p-3">
              <p class="font-mono-editorial text-[11px] font-normal uppercase tracking-[0.18em] text-ink-faded">
                {t().triggers}
              </p>
              <ToggleRow
                label={t().newTab}
                help={t().everyTabs(current().settings.frequency)}
                checked={current().settings.newTabTriggerEnabled}
                onChange={(checked) =>
                  updateSettings({ newTabTriggerEnabled: checked })
                }
              />
              <ToggleRow
                label={t().navigation}
                help={t().everyClicks(current().settings.frequency)}
                checked={current().settings.navigationTriggerEnabled}
                onChange={(checked) =>
                  updateSettings({ navigationTriggerEnabled: checked })
                }
              />
              <RangeField
                label={t().cooldown}
                value={current().settings.cooldownMinutes}
                min={0}
                max={15}
                suffix={t().min}
                onChange={(value) => updateSettings({ cooldownMinutes: value })}
              />
              <ToggleRow
                label={t().quietHours}
                help={t().quietSchedule(
                  current().settings.quietHours.startHour,
                  current().settings.quietHours.endHour,
                )}
                checked={current().settings.quietHours.enabled}
                onChange={(checked) => updateQuietHours({ enabled: checked })}
              />
            </section>

            <section class="grid gap-2">
              <button
                type="button"
                class="border border-accent bg-transparent px-4 py-3 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-accent hover:text-accent-deep disabled:opacity-60"
                onClick={triggerDemo}
                disabled={busy()}
              >
                {busy() ? t().triggering : t().demoTrigger}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={triggerOffRemainingMs() > 0}
                class="border border-rule px-4 py-3 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded hover:text-ink aria-checked:border-accent aria-checked:text-accent"
                onClick={toggleTriggersOff}
              >
                {triggerOffRemainingMs() > 0
                  ? `${t().triggersOff} · ${triggerOffLabel()}`
                  : t().turnOff30}
              </button>
              <a
                class="border border-rule px-4 py-3 text-center font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded hover:text-ink"
                href="dashboard.html"
                target="_blank"
                rel="noopener"
              >
                {t().openDashboard}
              </a>
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
    triggers: 'Когда показывать',
    newTab: 'Новая вкладка',
    everyTabs: (frequency: number) => `Каждые ${frequency} вкладки`,
    navigation: 'Страницы',
    everyClicks: (frequency: number) => `Каждые ${frequency} страницы`,
    cooldown: 'Перерыв',
    min: 'мин',
    quietHours: 'Не беспокоить',
    quietSchedule: (start: number, end: number) => `${start}:00–${end}:00`,
    triggering: 'Показываем…',
    demoTrigger: 'Показать пример',
    triggersOff: 'Задания выключены',
    turnOff30: 'Не показывать 30 мин',
    openDashboard: 'Мой прогресс',
  },
} as const

function ToggleRow(props: {
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div class="flex items-center justify-between gap-3 text-[15px]">
      <div>
        <p class="font-normal">{props.label}</p>
        <p class="font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
          {props.help}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-label={`${props.label}: ${props.checked ? 'on' : 'off'}`}
        class="relative h-7 w-14 shrink-0 border border-rule bg-paper text-left transition-colors hover:border-accent aria-checked:border-accent aria-checked:bg-accent"
        onClick={() => props.onChange(!props.checked)}
      >
        <span
          class="absolute left-1 top-1 h-5 w-5 bg-ink-faded transition-transform aria-checked:translate-x-7 aria-checked:bg-paper"
          aria-checked={props.checked}
        />
        <span class="sr-only">{props.checked ? 'On' : 'Off'}</span>
      </button>
    </div>
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


function sendRuntimeMessage(message: RuntimeMessage) {
  return chrome.runtime.sendMessage(message)
}

export default App
