import { createSignal, For, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import styles from './content.css?inline'
import { isRuntimeMessage, type RuntimeMessage } from './shared/messages'
import type { ChallengePayload, ChallengeResult } from './shared/types'

const CONTAINER_ID = 'bir-soz-extension-root'
const ANSWER_DISMISS_MS = 1200
const EXIT_MS = 120
let removeOverlay: (() => void) | undefined
let lastReadyUrl = window.location.href

void notifyContentReady()
watchUrlChanges(() => {
  void notifyContentReady()
})

document.addEventListener(
  'click',
  (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest('a[href]')
    if (!link) return

    void sendRuntimeMessage({
      type: 'bir-soz:navigation-click',
      href: link instanceof HTMLAnchorElement ? link.href : link.getAttribute('href') ?? undefined,
    })
  },
  { capture: true },
)

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) return

    if (message.type === 'bir-soz:show-challenge') {
      showOverlay(message.payload)
      sendResponse({ ok: true })
    }
  },
)

async function sendRuntimeMessage(message: RuntimeMessage) {
  try {
    if (!chrome.runtime?.id) return undefined
    return await chrome.runtime.sendMessage(message)
  } catch (error) {
    // This happens when the extension is reloaded/updated while a tab still has
    // the old content script injected. The page needs a refresh before that old
    // script can talk to the new extension context again.
    console.debug('[Bir Söz content] runtime message skipped', error)
    return undefined
  }
}

async function notifyContentReady() {
  lastReadyUrl = window.location.href
  await sendRuntimeMessage({ type: 'bir-soz:content-ready' })
}

function watchUrlChanges(onChange: () => void) {
  const notifyIfChanged = () => {
    window.setTimeout(() => {
      if (window.location.href === lastReadyUrl) return
      onChange()
    }, 0)
  }

  // In Chrome, content scripts run in an isolated world. Patching history here
  // catches same-world changes, but many SPAs (Reddit included) call history from
  // the page world, so keep a lightweight URL poll as the reliable fallback.
  window.setInterval(notifyIfChanged, 250)

  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args)
    notifyIfChanged()
    return result
  }

  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args)
    notifyIfChanged()
    return result
  }

  window.addEventListener('popstate', notifyIfChanged)
  window.addEventListener('hashchange', notifyIfChanged)
}

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
  const startedAt = Date.now()
  const [selected, setSelected] = createSignal<string>()
  const [feedback, setFeedback] = createSignal<string>()
  const [isExiting, setIsExiting] = createSignal(false)
  let hasSubmitted = false

  async function submit(
    correct: boolean,
    wasSkipped = false,
    immediateExit = false,
  ) {
    if (hasSubmitted) return
    hasSubmitted = true
    window.removeEventListener('keydown', onKeyDown)

    const elapsedMs = Date.now() - startedAt
    const payload: ChallengeResult = {
      wordId: props.payload.word.id,
      source: props.payload.source,
      elapsedMs,
      wasCorrect: correct,
      timedOut: false,
      wasSkipped,
    }

    await sendRuntimeMessage({ type: 'bir-soz:submit-result', payload })

    if (!wasSkipped) {
      setFeedback(`Answered in ${(elapsedMs / 1000).toFixed(1)}s`)
    }

    const delay = immediateExit || wasSkipped ? 0 : ANSWER_DISMISS_MS
    window.setTimeout(() => {
      setIsExiting(true)
      window.setTimeout(props.onClose, EXIT_MS)
    }, delay)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      void submit(false, true, true)
    }
  }

  const optionState = (option: string) => {
    const current = selected()
    if (!current) return 'neutral'
    if (option === props.payload.word.targetText) return 'correct'
    if (option === current) return 'wrong'
    return 'muted'
  }

  window.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div class="bir-soz-stage">
      <article
        class="bir-soz-card"
        classList={{
          'is-exiting': isExiting(),
        }}
      >
        <div class="bir-soz-paper-layer" />
        <div class="bir-soz-content">
          <header class="bir-soz-topline">
            <span>Перевод</span>
<span>sóz 1</span>
          </header>

          <section>
            <h2 class="bir-soz-word">
              {props.payload.word.sourceText}
              {selected() === props.payload.word.targetText && (
                <span class="bir-soz-glyph">+</span>
              )}
            </h2>
            <p class="bir-soz-prompt">
              Orys tilindegi aýdarmany tańdańyz
            </p>
          </section>

          <div class="bir-soz-rule" />

          <div class="bir-soz-options">
            <For each={props.payload.options}>
              {(option) => (
                <button
                  type="button"
                  class={`bir-soz-option is-${optionState(option)}`}
                  disabled={Boolean(selected())}
                  onClick={() => {
                    setSelected(option)
                    void submit(option === props.payload.word.targetText)
                  }}
                >
                  {option}
                </button>
              )}
            </For>
          </div>

          <footer class="bir-soz-bottom">
            <span>{feedback() ?? '•'}</span>
            <button
              type="button"
              class="bir-soz-skip"
              onClick={() => void submit(false, true, true)}
            >
              Skip
            </button>
          </footer>
        </div>
      </article>
    </div>
  )
}
