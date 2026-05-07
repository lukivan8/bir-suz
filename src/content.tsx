import { createSignal, For, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import styles from './content.css?inline'
import { isRuntimeMessage, type RuntimeMessage } from './shared/messages'
import type { ChallengePayload, ChallengeResult } from './shared/types'

const CONTAINER_ID = 'bir-soz-extension-root'
const ANSWER_DISMISS_MS = 1800
const EXIT_MS = 120
let removeOverlay: (() => void) | undefined

void sendRuntimeMessage({ type: 'bir-soz:content-ready' })

document.addEventListener(
  'click',
  (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest('a[href]')
    if (!link) return

    void sendRuntimeMessage({ type: 'bir-soz:navigation-click' })
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

function sendRuntimeMessage(message: RuntimeMessage) {
  return chrome.runtime.sendMessage(message)
}

function resolveOverlayTheme(theme: ChallengePayload['overlayTheme']) {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
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
  const theme = resolveOverlayTheme(props.payload.overlayTheme)
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
          'theme-dark': theme === 'dark',
          'theme-light': theme === 'light',
        }}
      >
        <div class="bir-soz-paper-layer" />
        <div class="bir-soz-content">
          <header class="bir-soz-topline">
            <span>Перевод</span>
            <span>word 1</span>
          </header>

          <section>
            <h2 class="bir-soz-word">
              {props.payload.word.sourceText}
              {selected() === props.payload.word.targetText && (
                <span class="bir-soz-glyph">+</span>
              )}
            </h2>
            <p class="bir-soz-prompt">
              Choose the {props.payload.word.targetLabel} translation
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
