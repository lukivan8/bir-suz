import { createResource, createSignal, Show } from 'solid-js'
import type { StorageShape } from './shared/types'

async function getState() {
  return (await chrome.runtime.sendMessage({
    type: 'bir-soz:get-state',
  })) as StorageShape
}

function App() {
  const [state, { mutate, refetch }] = createResource(getState)
  const [busy, setBusy] = createSignal(false)

  const disableForHour = async () => {
    const nextDisabledUntil = Date.now() + 60 * 60 * 1000
    await chrome.storage.local.set({
      settings: {
        ...state()?.settings,
        disabledUntil: nextDisabledUntil,
      },
    })
    await refetch()
  }

  const triggerDemo = async () => {
    setBusy(true)
    await chrome.runtime.sendMessage({ type: 'bir-soz:force-trigger' })
    await refetch()
    setBusy(false)
  }

  const toggleNewTab = async () => {
    const current = state()
    if (!current) return

    const next = {
      ...current,
      settings: {
        ...current.settings,
        newTabTriggerEnabled: !current.settings.newTabTriggerEnabled,
      },
    }

    mutate(next)
    await chrome.storage.local.set({ settings: next.settings })
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

            <section class="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium">New tab trigger</p>
                  <p class="text-xs text-stone-400">
                    Every {current().settings.frequency} tabs
                  </p>
                </div>
                <button
                  type="button"
                  class="rounded-full px-3 py-1 text-xs font-medium ring-1 ring-white/15 hover:bg-white/10"
                  onClick={toggleNewTab}
                >
                  {current().settings.newTabTriggerEnabled ? 'On' : 'Off'}
                </button>
              </div>
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
              <button
                type="button"
                class="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium hover:bg-white/5"
                onClick={disableForHour}
              >
                Disable for 1 hour
              </button>
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

export default App
