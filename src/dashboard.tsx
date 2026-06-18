import { createResource, For } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'
import type { RuntimeMessage } from './shared/messages'
import type { StorageShape } from './shared/types'

async function getState() {
  return (await sendRuntimeMessage({
    type: 'bir-soz:get-state',
  })) as StorageShape
}

function Dashboard() {
  const [state] = createResource(getState)

  const mastery = () => {
    const current = state()
    if (!current) return []

    return current.wordBank.map((word) => ({
      id: word.id,
      word: word.sourceText,
      percent: Math.min(100, Math.round((word.srs.repetition / 5) * 100)),
    }))
  }

  return (
    <main class="min-h-screen bg-stone-950 p-6 text-stone-50">
      <div class="mx-auto max-w-5xl space-y-6">
        <header>
          <p class="text-xs uppercase tracking-[0.24em] text-emerald-300">
            Bir Söz Dashboard
          </p>
          <h1 class="mt-2 text-4xl font-semibold">Retention snapshot</h1>
        </header>

        <section class="grid gap-4 md:grid-cols-3">
          <Card
            label="Active vocabulary"
            value={state()?.wordBank.length ?? 0}
          />
          <Card
            label="Time in language contact"
            value={`${Math.round((state()?.userStats.timeInLanguageContactMs ?? 0) / 1000)}s`}
          />
          <Card
            label="Success rate without hints"
            value={`${rate(state())}%`}
          />
        </section>

        <section class="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 class="text-xl font-semibold">Mastery heatmap</h2>
          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <For each={mastery()}>
              {(item) => (
                <div class="rounded-2xl border border-white/10 p-4">
                  <div class="mb-2 flex items-center justify-between text-sm">
                    <span>{item.word}</span>
                    <span class="text-stone-400">{item.percent}%</span>
                  </div>
                  <div class="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      class="h-full rounded-full bg-emerald-400"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </div>
    </main>
  )
}

function Card(props: { label: string; value: string | number }) {
  return (
    <div class="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p class="text-sm text-stone-400">{props.label}</p>
      <p class="mt-2 text-3xl font-semibold">{props.value}</p>
    </div>
  )
}

function rate(state: StorageShape | undefined) {
  if (!state || state.userStats.totalExposures === 0) return 0
  return Math.round(
    (state.userStats.totalCorrect / state.userStats.totalExposures) * 100,
  )
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

function sendRuntimeMessage(message: RuntimeMessage) {
  return chrome.runtime.sendMessage(message)
}

render(() => <Dashboard />, root)
