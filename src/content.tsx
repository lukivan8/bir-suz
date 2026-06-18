import { createEffect, createSignal, For, onCleanup, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import styles from './content.css?inline'
import {
  challengeResultMessage,
  contentReadyMessage,
  pageActivityMessage,
} from './shared/content-script-access'
import {
  isRuntimeMessage,
  type RuntimeMessage,
  type RuntimeResponseFor,
} from './shared/messages'
import type { ChallengePayload, ChallengeResult } from './shared/types'

const CONTAINER_ID = 'bir-soz-extension-root'
const ANSWER_DISMISS_MS = 1200
const EXIT_MS = 120
let removeOverlay: (() => void) | undefined
let pageActivityTimer: number | undefined

void notifyContentReady()
void notifyPageActivity()
watchPageActivity(notifyPageActivity)

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) return

    if (message.type === 'bir-soz:show-challenge') {
      showOverlay(message.payload)
      sendResponse({ ok: true })
    }
  },
)

async function sendRuntimeMessage<TMessage extends RuntimeMessage>(
  message: TMessage,
): Promise<RuntimeResponseFor<TMessage> | undefined> {
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
  await sendRuntimeMessage(contentReadyMessage)
}

function notifyPageActivity() {
  if (pageActivityTimer !== undefined) {
    window.clearTimeout(pageActivityTimer)
  }

  pageActivityTimer = window.setTimeout(() => {
    pageActivityTimer = undefined
    void sendRuntimeMessage(pageActivityMessage)
  }, 100)
}

function watchPageActivity(onChange: () => void) {
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args)
    onChange()
    return result
  }

  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args)
    onChange()
    return result
  }

  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onChange)

  const navigationApi = globalThis.navigation
  navigationApi?.addEventListener('currententrychange', onChange)
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
  const [wordFontSize, setWordFontSize] = createSignal(52)
  const [isWordWrapped, setIsWordWrapped] = createSignal(false)
  let wordElement: HTMLHeadingElement | undefined
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

    await sendRuntimeMessage(challengeResultMessage(payload))

    if (!wasSkipped) {
      setFeedback(`Ответ за ${(elapsedMs / 1000).toFixed(1)} с`)
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
    if (option === props.payload.answerText) return 'correct'
    if (option === current) return 'wrong'
    return 'muted'
  }

  const promptCopy = () =>
    props.payload.direction === 'target-to-source'
      ? 'Qazaq tilindegi audarmany tañdañyz'
      : 'Orys tilindegi audarmany tañdañyz'

  function fitWord() {
    const element = wordElement
    if (!element) return

    element.classList.remove('is-wrapped')

    let size = 52
    element.style.setProperty('--bir-soz-word-size', `${size}px`)

    while (size > 32 && element.scrollWidth > element.clientWidth) {
      size -= 1
      element.style.setProperty('--bir-soz-word-size', `${size}px`)
    }

    const shouldWrap = element.scrollWidth > element.clientWidth
    element.classList.toggle('is-wrapped', shouldWrap)
    setWordFontSize(size)
    setIsWordWrapped(shouldWrap)
  }

  createEffect(() => {
    props.payload.promptText
    const frame = window.requestAnimationFrame(fitWord)
    onCleanup(() => window.cancelAnimationFrame(frame))
  })

  onMount(() => {
    const observer = new ResizeObserver(fitWord)
    if (wordElement) observer.observe(wordElement)
    onCleanup(() => observer.disconnect())
  })

  window.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div
      class="bir-soz-stage"
      classList={{
        'is-exiting': isExiting(),
      }}
    >
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
            <span>söz 1</span>
          </header>

          <section>
            <h2
              ref={wordElement}
              class="bir-soz-word"
              classList={{ 'is-wrapped': isWordWrapped() }}
              style={`--bir-soz-word-size: ${wordFontSize()}px`}
            >
              {props.payload.promptText}
              {selected() === props.payload.answerText && (
                <span class="bir-soz-glyph">+</span>
              )}
            </h2>
            <p class="bir-soz-prompt">{promptCopy()}</p>
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
                    void submit(option === props.payload.answerText)
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
              Пропустить
            </button>
          </footer>
        </div>
      </article>
    </div>
  )
}
