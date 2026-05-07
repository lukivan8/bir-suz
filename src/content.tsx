import { createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import styles from './content.css?inline'
import type { ChallengePayload, ChallengeResult } from './shared/types'

const CONTAINER_ID = 'bir-soz-extension-root'
const TIMER_MS = 5000

let removeOverlay: (() => void) | undefined

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'bir-soz:show-challenge') {
    showOverlay(message.payload as ChallengePayload)
    sendResponse({ ok: true })
  }
})

function showOverlay(payload: ChallengePayload) {
  removeOverlay?.()

  const host = document.createElement('div')
  host.id = CONTAINER_ID
  document.documentElement.appendChild(host)

  const shadowRoot = host.attachShadow({ mode: 'open' })
  const styleTag = document.createElement('style')
  styleTag.textContent = styles
  shadowRoot.appendChild(styleTag)

  const appRoot = document.createElement('div')
  shadowRoot.appendChild(appRoot)

  const dispose = render(
    () => <Overlay payload={payload} onClose={cleanup} />,
    appRoot,
  )

  function cleanup() {
    dispose()
    host.remove()
    removeOverlay = undefined
  }

  removeOverlay = cleanup
}

function Overlay(props: { payload: ChallengePayload; onClose: () => void }) {
  const [selected, setSelected] = createSignal<string>()
  const [remaining, setRemaining] = createSignal(TIMER_MS)
  const startedAt = Date.now()

  const interval = window.setInterval(() => {
    setRemaining((value) => {
      const next = value - 100
      if (next <= 0) {
        window.clearInterval(interval)
        void submit(false, true, true)
        return 0
      }
      return next
    })
  }, 100)

  async function submit(
    correct: boolean,
    timedOut = false,
    wasSkipped = false,
  ) {
    window.clearInterval(interval)

    const payload: ChallengeResult = {
      wordId: props.payload.word.id,
      source: props.payload.source,
      elapsedMs: Date.now() - startedAt,
      wasCorrect: correct,
      timedOut,
      wasSkipped,
    }

    await chrome.runtime.sendMessage({ type: 'bir-soz:submit-result', payload })
    props.onClose()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      void submit(false, false, true)
    }
  }

  window.addEventListener('keydown', onKeyDown, { once: true })

  return (
    <div class="fixed inset-0 z-[2147483647] flex items-start justify-center bg-black/20 p-6 font-sans text-slate-900">
      <div class="mt-6 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div class="h-1 w-full bg-slate-100">
          <div
            class="h-full bg-emerald-500 transition-[width] duration-100"
            style={{ width: `${(remaining() / TIMER_MS) * 100}%` }}
          />
        </div>

        <div class="space-y-4 p-5">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
            <span>Bir Söz</span>
            <button
              type="button"
              class="font-medium text-slate-400 hover:text-slate-700"
              onClick={() => void submit(false, false, true)}
            >
              Esc / Skip
            </button>
          </div>

          <div>
            <p class="text-sm text-slate-500">Choose the Russian translation</p>
            <h2 class="mt-1 text-3xl font-semibold">{props.payload.word.kk}</h2>
          </div>

          <div class="grid gap-2">
            <For each={props.payload.options}>
              {(option) => (
                <button
                  type="button"
                  class="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium hover:border-emerald-400 hover:bg-emerald-50"
                  onClick={() => {
                    setSelected(option)
                    void submit(option === props.payload.word.ru)
                  }}
                >
                  {option}
                </button>
              )}
            </For>
          </div>

          <Show when={selected()}>
            <p class="text-xs text-slate-500">Answer recorded</p>
          </Show>
        </div>
      </div>
    </div>
  )
}
