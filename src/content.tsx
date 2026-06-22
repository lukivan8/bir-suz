import { createEffect, createSignal, For, onCleanup, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import styles from './content.css?inline'
import { isDisabled } from './shared/challenge'
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
import { isMastered } from './shared/srs'
import type {
  ChallengePayload,
  ChallengeResult,
  Vocabulary,
} from './shared/types'

const CONTAINER_ID = 'bir-soz-extension-root'
const CORRECT_ANSWER_DISMISS_MS = 1200
const WRONG_ANSWER_DISMISS_MS = 1700
const EXIT_MS = 120
const REPLACED_WORD_CLASS = 'bir-soz-learned-word'
const REPLACED_WORD_STYLE_ID = 'bir-soz-learned-word-style'
const WORD_POPOVER_CLASS = 'bir-soz-word-popover'
let removeOverlay: (() => void) | undefined
let pageActivityTimer: number | undefined
let refreshLearnedWordsTimer: number | undefined
let doNotDisturbTimer: number | undefined
let learnedWordsObserver: MutationObserver | undefined
let learnedWordPopover: HTMLDivElement | undefined
let hideLearnedWordPopoverTimer: number | undefined
let learnedWordsDisabledForPage = false

void notifyContentReady()
void notifyPageActivity()
watchPageActivity(notifyPageActivity)
void refreshLearnedWords()
watchLearnedWords()

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

function watchLearnedWords() {
  learnedWordsObserver = new MutationObserver(scheduleLearnedWordsRefresh)
  observeLearnedWords()

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === 'local' &&
      ('vocabularies' in changes || 'settings' in changes)
    ) {
      scheduleLearnedWordsRefresh()
    }
  })
}

function observeLearnedWords() {
  learnedWordsObserver?.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

function scheduleLearnedWordsRefresh() {
  if (refreshLearnedWordsTimer !== undefined) {
    window.clearTimeout(refreshLearnedWordsTimer)
  }

  refreshLearnedWordsTimer = window.setTimeout(() => {
    refreshLearnedWordsTimer = undefined
    void refreshLearnedWords()
  }, 250)
}

async function refreshLearnedWords() {
  if (learnedWordsDisabledForPage) return

  const storage = await chrome.storage.local.get(['vocabularies', 'settings'])
  const vocabularies = Reflect.get(storage, 'vocabularies')
  const disabledUntil = getDisabledUntil(Reflect.get(storage, 'settings'))
  const replacements = learnedWordReplacements(vocabularies)

  learnedWordsObserver?.disconnect()
  try {
    if (disabledUntil && isDisabled(disabledUntil)) {
      restoreNoLongerLearnedWords(new Map())
      scheduleDoNotDisturbRefresh(disabledUntil)
      return
    }

    window.clearTimeout(doNotDisturbTimer)
    doNotDisturbTimer = undefined
    restoreNoLongerLearnedWords(replacements)
    if (replacements.size === 0) return

    installLearnedWordStyles()
    replaceLearnedWordsInPage(replacements)
  } finally {
    observeLearnedWords()
  }
}

function getDisabledUntil(settings: unknown) {
  if (!settings || typeof settings !== 'object') return undefined
  const disabledUntil = Reflect.get(settings, 'disabledUntil')
  return typeof disabledUntil === 'number' ? disabledUntil : undefined
}

function scheduleDoNotDisturbRefresh(disabledUntil: number) {
  window.clearTimeout(doNotDisturbTimer)
  doNotDisturbTimer = window.setTimeout(
    () => {
      doNotDisturbTimer = undefined
      void refreshLearnedWords()
    },
    Math.max(0, disabledUntil - Date.now()) + 50,
  )
}

function learnedWordReplacements(value: unknown) {
  const replacements = new Map<string, string[]>()
  if (!Array.isArray(value)) return replacements

  for (const vocabulary of value as Vocabulary[]) {
    if (!vocabulary || !Array.isArray(vocabulary.words)) continue

    for (const word of vocabulary.words) {
      if (
        !isMastered(word) ||
        !word.targetText.trim() ||
        !word.sourceText.trim()
      ) {
        continue
      }

      const target = normalizeRussian(word.targetText)
      const sources = replacements.get(target) ?? []
      if (!sources.includes(word.sourceText)) sources.push(word.sourceText)
      replacements.set(target, sources)
    }
  }

  return replacements
}

function restoreNoLongerLearnedWords(replacements: Map<string, string[]>) {
  for (const element of document.querySelectorAll<HTMLElement>(
    `span.${REPLACED_WORD_CLASS}`,
  )) {
    const original = element.getAttribute('data-bir-soz-original') ?? undefined
    const replacement =
      element.getAttribute('data-bir-soz-replacement') ?? undefined
    if (
      !original ||
      !replacement ||
      !replacements.get(normalizeRussian(original))?.includes(replacement)
    ) {
      element.replaceWith(
        document.createTextNode(original ?? element.textContent ?? ''),
      )
    }
  }
}

function installLearnedWordStyles() {
  if (document.getElementById(REPLACED_WORD_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = REPLACED_WORD_STYLE_ID
  style.textContent = `
    .${REPLACED_WORD_CLASS} {
      color: inherit;
      text-decoration-line: underline !important;
      text-decoration-color: #a8531c !important;
      text-decoration-thickness: 2px !important;
      text-underline-offset: 0.16em !important;
      cursor: help;
      transition: background-color 120ms ease, color 120ms ease;
    }
    .${REPLACED_WORD_CLASS}:hover,
    .${REPLACED_WORD_CLASS}.is-popover-open {
      color: #7a3a10;
      background: rgba(168, 83, 28, 0.15);
    }
    .${WORD_POPOVER_CLASS} {
      position: fixed;
      z-index: 2147483647;
      width: min(244px, calc(100vw - 24px));
      padding: 12px;
      color: #f2ebdc;
      background: #1a1612;
      border: 1px solid rgba(168, 83, 28, 0.8);
      box-shadow: 0 12px 28px rgba(26, 22, 18, 0.28);
      font-family: Georgia, "Times New Roman", serif;
    }
    .${WORD_POPOVER_CLASS}-label {
      display: block;
      margin-bottom: 3px;
      color: #d4a574;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .${WORD_POPOVER_CLASS}-original {
      display: block;
      font-size: 20px;
      line-height: 1.15;
    }
    .${WORD_POPOVER_CLASS}-restore {
      width: 100%;
      margin-top: 11px;
      padding: 7px 8px;
      color: #f2ebdc;
      background: transparent;
      border: 1px solid rgba(242, 235, 220, 0.38);
      font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .${WORD_POPOVER_CLASS}-restore:hover {
      color: #1a1612;
      background: #f2ebdc;
    }
  `
  document.head?.appendChild(style)
}

function replaceLearnedWordsInPage(replacements: Map<string, string[]>) {
  const matcher = createReplacementMatcher(replacements)
  if (!matcher || !document.body) return

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return canReplaceTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
      },
    },
  )
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }

  for (const textNode of nodes) {
    replaceTextNode(textNode, matcher, replacements)
  }
}

function createReplacementMatcher(replacements: Map<string, string[]>) {
  const words = [...replacements.keys()].sort((a, b) => b.length - a.length)
  if (words.length === 0) return undefined

  const alternatives = words.map(escapeRegExp).join('|')
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(${alternatives})(?![\\p{L}\\p{N}_])`,
    'giu',
  )
}

function canReplaceTextNode(node: Node) {
  const parent = node.parentElement
  if (!parent || !node.textContent?.trim()) return false
  if (parent.closest(`.${REPLACED_WORD_CLASS}, .${WORD_POPOVER_CLASS}`)) {
    return false
  }
  if (
    parent.closest('[contenteditable="true"], input, textarea, select, option')
  ) {
    return false
  }

  return !parent.closest(
    'script, style, noscript, pre, code, kbd, samp, svg, math',
  )
}

function replaceTextNode(
  textNode: Text,
  matcher: RegExp,
  replacements: Map<string, string[]>,
) {
  const text = textNode.textContent ?? ''
  matcher.lastIndex = 0
  let lastIndex = 0
  let match: RegExpExecArray | null
  const fragment = document.createDocumentFragment()

  match = matcher.exec(text)
  while (match) {
    if (Math.random() >= 0.5) {
      match = matcher.exec(text)
      continue
    }

    const original = match[0]
    const sources = replacements.get(normalizeRussian(original))
    if (!sources?.length) {
      match = matcher.exec(text)
      continue
    }

    fragment.append(text.slice(lastIndex, match.index))
    const replacement = matchReplacementCapitalization(
      original,
      sources[Math.floor(Math.random() * sources.length)] ?? original,
    )
    const span = document.createElement('span')
    span.className = REPLACED_WORD_CLASS
    span.textContent = replacement
    span.setAttribute('aria-label', `${replacement} (${original})`)
    span.setAttribute('data-bir-soz-original', original)
    span.setAttribute('data-bir-soz-replacement', replacement)
    addLearnedWordPopover(span, original)
    fragment.append(span)
    lastIndex = match.index + original.length
    match = matcher.exec(text)
  }

  if (lastIndex === 0) return
  fragment.append(text.slice(lastIndex))
  textNode.replaceWith(fragment)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeRussian(value: string) {
  return value.toLocaleLowerCase('ru')
}

function matchReplacementCapitalization(original: string, replacement: string) {
  const letters = original.match(/\p{L}/gu) ?? []
  const lowercaseReplacement = replacement.toLocaleLowerCase('kk')
  if (letters.length === 0) return lowercaseReplacement

  if (letters.every((letter) => letter === letter.toLocaleUpperCase('ru'))) {
    return replacement.toLocaleUpperCase('kk')
  }

  const firstLetter = letters[0]
  if (firstLetter && firstLetter === firstLetter.toLocaleUpperCase('ru')) {
    return lowercaseReplacement.replace(/\p{L}/u, (letter) =>
      letter.toLocaleUpperCase('kk'),
    )
  }

  return lowercaseReplacement
}

function addLearnedWordPopover(word: HTMLElement, original: string) {
  word.addEventListener('pointerenter', () => {
    window.clearTimeout(hideLearnedWordPopoverTimer)
    showLearnedWordPopover(word, original)
  })
  word.addEventListener('pointerleave', scheduleLearnedWordPopoverHide)
}

function showLearnedWordPopover(word: HTMLElement, original: string) {
  removeLearnedWordPopover()
  word.classList.add('is-popover-open')

  const popover = document.createElement('div')
  popover.className = WORD_POPOVER_CLASS
  popover.innerHTML = `
    <span class="${WORD_POPOVER_CLASS}-label">В оригинале</span>
    <strong class="${WORD_POPOVER_CLASS}-original"></strong>
    <button class="${WORD_POPOVER_CLASS}-restore" type="button">Вернуть всю страницу</button>
  `
  const originalText = popover.querySelector(`.${WORD_POPOVER_CLASS}-original`)
  if (originalText) originalText.textContent = original
  popover.addEventListener('pointerenter', () => {
    window.clearTimeout(hideLearnedWordPopoverTimer)
  })
  popover.addEventListener('pointerleave', scheduleLearnedWordPopoverHide)
  popover
    .querySelector(`.${WORD_POPOVER_CLASS}-restore`)
    ?.addEventListener('click', restorePageOriginalWords)

  learnedWordsObserver?.disconnect()
  document.body.append(popover)
  observeLearnedWords()
  learnedWordPopover = popover
  positionLearnedWordPopover(word, popover)
}

function positionLearnedWordPopover(word: HTMLElement, popover: HTMLElement) {
  const wordRect = word.getBoundingClientRect()
  const popoverRect = popover.getBoundingClientRect()
  const left = Math.min(
    Math.max(12, wordRect.left),
    window.innerWidth - popoverRect.width - 12,
  )
  const fitsBelow =
    wordRect.bottom + 10 + popoverRect.height < window.innerHeight - 12

  popover.style.left = `${left}px`
  popover.style.top = `${fitsBelow ? wordRect.bottom + 10 : wordRect.top - 10}px`
  popover.style.transform = fitsBelow ? '' : 'translateY(-100%)'
}

function scheduleLearnedWordPopoverHide() {
  window.clearTimeout(hideLearnedWordPopoverTimer)
  hideLearnedWordPopoverTimer = window.setTimeout(removeLearnedWordPopover, 120)
}

function removeLearnedWordPopover() {
  document
    .querySelector<HTMLElement>(`.${REPLACED_WORD_CLASS}.is-popover-open`)
    ?.classList.remove('is-popover-open')
  learnedWordsObserver?.disconnect()
  learnedWordPopover?.remove()
  observeLearnedWords()
  learnedWordPopover = undefined
}

function restorePageOriginalWords() {
  learnedWordsDisabledForPage = true
  window.clearTimeout(hideLearnedWordPopoverTimer)
  removeLearnedWordPopover()
  restoreNoLongerLearnedWords(new Map())
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
  const [answerResult, setAnswerResult] = createSignal<'correct' | 'wrong'>()
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
    if (!wasSkipped) {
      setAnswerResult(correct ? 'correct' : 'wrong')
      setFeedback(`Ответ за ${(elapsedMs / 1000).toFixed(1)} с`)
    }

    const payload: ChallengeResult = {
      wordId: props.payload.word.id,
      source: props.payload.source,
      elapsedMs,
      wasCorrect: correct,
      timedOut: false,
      wasSkipped,
    }

    await sendRuntimeMessage(challengeResultMessage(payload))

    const delay =
      immediateExit || wasSkipped
        ? 0
        : correct
          ? CORRECT_ANSWER_DISMISS_MS
          : WRONG_ANSWER_DISMISS_MS
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
      ? 'Выберите перевод на казахский'
      : 'Выберите перевод на русский'

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
        'has-correct-answer': answerResult() === 'correct',
        'has-wrong-answer': answerResult() === 'wrong',
      }}
    >
      <article
        class="bir-soz-card"
        classList={{
          'is-exiting': isExiting(),
          'has-correct-answer': answerResult() === 'correct',
          'has-wrong-answer': answerResult() === 'wrong',
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
