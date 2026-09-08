import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js'
import type { StudyAction } from '../shared/study-service'
import type { Confidence, StudySession } from '../shared/types'

const ratings: { value: Confidence; label: string }[] = [
  { value: -2, label: '-2 Не помню' },
  { value: -1, label: '-1 Очень трудно' },
  { value: 0, label: '0 Не уверен' },
  { value: 1, label: '+1 Помню' },
  { value: 2, label: '+2 Легко' },
]

export function StudyModal(props: {
  session: StudySession | null
  ready: boolean
  onboarding?: boolean
  refresh: () => unknown
  onClose: () => void
}) {
  const [open, setOpen] = createSignal(props.session?.completedAt === null)
  let dialog!: HTMLDialogElement
  onMount(() => dialog.showModal())
  onCleanup(() => dialog.close())
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  let showRequested = ''
  let startRequested = ''
  let lastAction: StudyAction | undefined
  let face: HTMLButtonElement | undefined
  const active = () =>
    props.session?.completedAt === null ? props.session : null
  async function send(payload: StudyAction) {
    if (busy()) return
    lastAction = payload
    setBusy(true)
    setError('')
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'bir-soz:study',
        payload,
      })
      if (!result?.ok)
        setError(result?.error ?? 'Не удалось сохранить карточку. Повторите.')
      await props.refresh()
    } catch {
      setError('Не удалось сохранить карточку. Повторите.')
    } finally {
      setBusy(false)
    }
  }
  async function start() {
    await send({ action: 'start', onboarding: props.onboarding ?? false })
    showRequested = ''
    setOpen(true)
  }
  async function flip() {
    const session = active()
    if (session && !session.flipped)
      await send({
        action: 'flip',
        sessionId: session.id,
        index: session.index,
      })
  }
  async function rate(confidence: Confidence) {
    const session = active()
    if (session?.flipped)
      await send({
        action: 'rate',
        sessionId: session.id,
        index: session.index,
        confidence,
      })
  }
  createEffect(() => {
    const key = props.session?.id ?? 'initial'
    if (
      props.ready &&
      !active() &&
      !busy() &&
      !error() &&
      startRequested !== key
    ) {
      startRequested = key
      void start()
    }
  })
  createEffect(() => {
    const session = active()
    const showing = open()
    if (
      showing &&
      session &&
      session.shownAt === null &&
      !busy() &&
      showRequested !== `${session.id}:${session.index}`
    ) {
      showRequested = `${session.id}:${session.index}`
      void send({ action: 'show', sessionId: session.id, index: session.index })
    }
  })
  createEffect(() => {
    const session = active()
    if (open() && session && !session.flipped && !busy())
      queueMicrotask(() => face?.focus())
  })
  const keydown = (event: KeyboardEvent) => {
    if (
      !open() ||
      !active()?.flipped ||
      busy() ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return
    const rating = ratings[Number(event.key) - 1]
    if (rating && /^[1-5]$/.test(event.key)) {
      event.preventDefault()
      void rate(rating.value)
    }
  }
  document.addEventListener('keydown', keydown)
  onCleanup(() => document.removeEventListener('keydown', keydown))
  return (
    <dialog
      ref={dialog}
      class="advanced-modal word-modal study-modal"
      aria-label="Изучать слова"
      onCancel={(event) => {
        event.preventDefault()
        props.onClose()
      }}
      onPointerDown={(event) => {
        if (event.target === dialog) {
          const rect = dialog.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            props.onClose()
        }
      }}
    >
      <button type="button" class="modal-close" onClick={props.onClose}>
        Закрыть
      </button>
      <div class="study-panel">
        <h2 class="section-heading">Изучать слова</h2>
        <Show when={!props.ready}>
          <p>Ожидаем загрузку словарей.</p>
          <button
            type="button"
            class="dashboard-settings-button"
            onClick={async () => {
              await chrome.runtime.sendMessage({ type: 'bir-soz:sync-catalog' })
              await props.refresh()
            }}
          >
            Повторить загрузку
          </button>
        </Show>
        <Show when={props.ready && !active() && !error()}>
          <p role="status">Подготавливаем карточку…</p>
        </Show>
        <Show when={open() && active()}>
          {(session) => {
            const card = () => session().cards[session().index]
            return (
              <div class="grid gap-4">
                <p>{card()?.vocabularyName}</p>
                <button
                  ref={face}
                  type="button"
                  class="study-card"
                  disabled={
                    busy() || session().shownAt === null || session().flipped
                  }
                  onClick={flip}
                  aria-label={
                    session().flipped ? 'Перевод' : 'Показать перевод'
                  }
                >
                  <span>
                    {session().flipped
                      ? card()?.word.targetText
                      : card()?.word.sourceText}
                  </span>
                  <small>
                    {session().flipped
                      ? 'Оцените уверенность'
                      : 'Нажмите, чтобы увидеть перевод · Space / Enter'}
                  </small>
                </button>
                <div class="study-ratings">
                  <For each={ratings}>
                    {(rating) => (
                      <button
                        type="button"
                        class="dashboard-settings-button"
                        disabled={!session().flipped || busy()}
                        onClick={() => rate(rating.value)}
                      >
                        {rating.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            )
          }}
        </Show>
        <Show when={error()}>
          <p role="alert">{error()}</p>
          <button
            type="button"
            class="dashboard-settings-button"
            disabled={busy()}
            onClick={() => lastAction && send(lastAction)}
          >
            Повторить сохранение
          </button>
        </Show>
      </div>
    </dialog>
  )
}
