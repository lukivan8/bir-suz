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

  return (
    <main class="min-w-80 space-y-4 bg-paper p-5 font-serif-body text-[17px] leading-[1.55] text-ink">
      <header class="space-y-1">
        <p class="font-mono-editorial text-[11px] uppercase tracking-[0.2em] text-accent">
          Bir Söz
        </p>
        <h1 class="font-serif-display text-[28px] font-light italic leading-[1.15]">
          Micro-learning overlay
        </h1>
        <p class="text-[15px] text-ink-soft">
          Zero-decision Kazakh retention for idle moments.
        </p>
      </header>

      <Show when={state()}>
        {(current) => (
          <>
            <section class="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Words" value={current().wordBank.length} />
              <Metric label="Success" value={`${successRate()}%`} />
              <Metric
                label="Exposures"
                value={current().userStats.totalExposures}
              />
              <Metric
                label="Cooldown"
                value={`${current().settings.cooldownMinutes}m`}
              />
            </section>

            <section class="space-y-3 border border-rule bg-paper-deep p-3">
              <p class="font-mono-editorial text-[11px] font-normal uppercase tracking-[0.18em] text-ink-faded">
                Triggers
              </p>
              <ToggleRow
                label="New tab"
                help={`Every ${current().settings.frequency} tabs`}
                checked={current().settings.newTabTriggerEnabled}
                onChange={(checked) =>
                  updateSettings({ newTabTriggerEnabled: checked })
                }
              />
              <ToggleRow
                label="Idle return"
                help="When you come back"
                checked={current().settings.idleTriggerEnabled}
                onChange={(checked) =>
                  updateSettings({ idleTriggerEnabled: checked })
                }
              />
              <ToggleRow
                label="Navigation"
                help={`Every ${current().settings.frequency} link clicks`}
                checked={current().settings.navigationTriggerEnabled}
                onChange={(checked) =>
                  updateSettings({ navigationTriggerEnabled: checked })
                }
              />
            </section>

            <section class="space-y-3 border border-rule bg-paper-deep p-3">
              <p class="font-mono-editorial text-[11px] font-normal uppercase tracking-[0.18em] text-ink-faded">
                Frequency
              </p>
              <NumberField
                label="Challenge frequency"
                value={current().settings.frequency}
                min={1}
                max={20}
                suffix="events"
                onChange={(value) => updateSettings({ frequency: value })}
              />
              <NumberField
                label="Cooldown"
                value={current().settings.cooldownMinutes}
                min={0}
                max={240}
                suffix="minutes"
                onChange={(value) => updateSettings({ cooldownMinutes: value })}
              />
            </section>

            <section class="space-y-3 border border-rule bg-paper-deep p-3">
              <ToggleRow
                label="Quiet hours"
                help={`${current().settings.quietHours.startHour}:00–${current().settings.quietHours.endHour}:00`}
                checked={current().settings.quietHours.enabled}
                onChange={(checked) => updateQuietHours({ enabled: checked })}
              />
              <div class="grid grid-cols-2 gap-2">
                <NumberField
                  label="Start"
                  value={current().settings.quietHours.startHour}
                  min={0}
                  max={23}
                  suffix="h"
                  onChange={(value) => updateQuietHours({ startHour: value })}
                />
                <NumberField
                  label="End"
                  value={current().settings.quietHours.endHour}
                  min={0}
                  max={23}
                  suffix="h"
                  onChange={(value) => updateQuietHours({ endHour: value })}
                />
              </div>
            </section>

            <section class="grid gap-2">
              <button
                type="button"
                class="border border-accent bg-transparent px-4 py-3 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-accent hover:text-accent-deep disabled:opacity-60"
                onClick={triggerDemo}
                disabled={busy()}
              >
                {busy() ? 'Triggering…' : 'Demo Trigger'}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={triggerOffRemainingMs() > 0}
                class="border border-rule px-4 py-3 font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded hover:text-ink aria-checked:border-accent aria-checked:text-accent"
                onClick={toggleTriggersOff}
              >
                {triggerOffRemainingMs() > 0
                  ? `Triggers off · ${triggerOffLabel()}`
                  : 'Turn triggers off for 30m'}
              </button>
              <a
                class="border border-rule px-4 py-3 text-center font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded hover:text-ink"
                href="dashboard.html"
                target="_blank"
                rel="noopener"
              >
                Open dashboard
              </a>
            </section>

            <p class="font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
              Primary jury hotkey name: Demo Trigger.
            </p>
          </>
        )}
      </Show>
    </main>
  )
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div class="border border-rule bg-paper-deep p-3">
      <p class="font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
        {props.label}
      </p>
      <p class="mt-1 font-serif-display text-[22px] font-light italic">
        {props.value}
      </p>
    </div>
  )
}

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

function NumberField(props: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label class="flex items-center justify-between gap-3 text-[15px]">
      <span>
        <span class="block">{props.label}</span>
        <span class="font-mono-editorial text-[11px] uppercase tracking-[0.12em] text-ink-faded">
          {props.suffix}
        </span>
      </span>
      <input
        class="w-20 border border-rule bg-paper-deep px-2 py-1 text-right font-mono-editorial text-[11px] text-ink"
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) => {
          const value = Number(event.currentTarget.value)
          if (Number.isNaN(value)) return
          props.onChange(Math.min(props.max, Math.max(props.min, value)))
        }}
      />
    </label>
  )
}

function sendRuntimeMessage(message: RuntimeMessage) {
  return chrome.runtime.sendMessage(message)
}

export default App
