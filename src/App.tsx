import { createResource, createSignal, Show } from 'solid-js'
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

  const pauseForMinutes = async (minutes: number) => {
    await updateSettings({ disabledUntil: Date.now() + minutes * 60 * 1000 })
    await refetch()
  }

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
    <main class="min-w-80 space-y-4 bg-stone-950 p-4 text-stone-50">
      <header class="space-y-1">
        <p class="text-xs uppercase tracking-[0.24em] text-emerald-300">
          Bir Söz
        </p>
        <h1 class="text-2xl font-semibold">Micro-learning overlay</h1>
        <p class="text-sm text-stone-300">
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

            <section class="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
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

            <section class="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
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

            <section class="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
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

            <section class="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <label class="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span class="block font-medium">Theme</span>
                  <span class="text-xs text-stone-400">Overlay preference</span>
                </span>
                <select
                  class="rounded-lg border border-white/10 bg-stone-900 px-2 py-1 text-xs text-stone-50"
                  value={current().settings.overlayTheme}
                  onChange={(event) =>
                    updateSettings({
                      overlayTheme: event.currentTarget
                        .value as AppSettings['overlayTheme'],
                    })
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </section>

            <section class="grid gap-2">
              <button
                type="button"
                class="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-stone-950 hover:bg-emerald-300 disabled:opacity-60"
                onClick={triggerDemo}
                disabled={busy()}
              >
                {busy() ? 'Triggering…' : 'Demo Trigger'}
              </button>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  class="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium hover:bg-white/5"
                  onClick={() => pauseForMinutes(30)}
                >
                  Pause 30m
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium hover:bg-white/5"
                  onClick={() => pauseForMinutes(60)}
                >
                  Pause 1h
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium hover:bg-white/5"
                  onClick={() => pauseForMinutes(240)}
                >
                  Pause 4h
                </button>
              </div>
              <a
                class="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-medium hover:bg-white/5"
                href="dashboard.html"
                target="_blank"
                rel="noopener"
              >
                Open dashboard
              </a>
            </section>

            <p class="text-[11px] text-stone-500">
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
    <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p class="text-xs text-stone-400">{props.label}</p>
      <p class="mt-1 text-lg font-semibold">{props.value}</p>
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
    <div class="flex items-center justify-between gap-3 text-sm">
      <div>
        <p class="font-medium">{props.label}</p>
        <p class="text-xs text-stone-400">{props.help}</p>
      </div>
      <button
        type="button"
        class="rounded-full px-3 py-1 text-xs font-medium ring-1 ring-white/15 hover:bg-white/10"
        onClick={() => props.onChange(!props.checked)}
      >
        {props.checked ? 'On' : 'Off'}
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
    <label class="flex items-center justify-between gap-3 text-sm">
      <span>
        <span class="block font-medium">{props.label}</span>
        <span class="text-xs text-stone-400">{props.suffix}</span>
      </span>
      <input
        class="w-20 rounded-lg border border-white/10 bg-stone-900 px-2 py-1 text-right text-xs text-stone-50"
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
