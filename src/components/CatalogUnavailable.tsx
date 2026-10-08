import { createSignal, createUniqueId, type JSX, onMount, Show } from 'solid-js'
import { closeOnBackdrop } from './dialog'
import { HelpModal } from './HelpModal'

/**
 * Warns that vocabularies are missing. Shown as a modal on the popup and
 * dashboard; inline inside dialogs that already are modal (Study). Closing the
 * modal retries the download and reopens it if vocabularies are still missing.
 */
export function CatalogUnavailable(props: {
  refresh: () => unknown
  modal?: boolean
}) {
  const [busy, setBusy] = createSignal(false)
  const [failed, setFailed] = createSignal(false)
  const [isHelpOpen, setIsHelpOpen] = createSignal(false)
  const [dismissed, setDismissed] = createSignal(false)
  const headingId = createUniqueId()
  let pending: Promise<boolean> | undefined
  function retry() {
    pending ??= sync().finally(() => {
      pending = undefined
    })
    return pending
  }
  async function sync() {
    setBusy(true)
    setFailed(false)
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'bir-soz:sync-catalog',
      })
      const ok = Boolean(result?.ok)
      setFailed(!ok)
      await props.refresh()
      return ok
    } catch {
      setFailed(true)
      return false
    } finally {
      setBusy(false)
    }
  }
  async function closeAndRetry() {
    setDismissed(true)
    if (!(await retry())) setDismissed(false)
  }
  // Only the heading text changes between states, so the card keeps its size.
  const heading = () =>
    busy()
      ? 'Загружаем словари…'
      : failed()
        ? 'Не удалось загрузить словари'
        : 'Словари не загружены'

  const content = (close?: () => void) => (
    <>
      <div class="catalog-unavailable-top">
        <span class="catalog-unavailable-eyebrow">Внимание</span>
        <Show when={close}>
          {(onClose) => (
            <button type="button" class="modal-close" onClick={onClose()}>
              закрыть
            </button>
          )}
        </Show>
      </div>
      <h2 id={headingId} class="catalog-unavailable-heading">
        <span role="status">{heading()}</span>
      </h2>
      <p>
        Без словарей задания не появятся. Убедитесь, что интернет включён, и
        повторите загрузку. Если не помогло, возможно, сервер недоступен или
        рабочая сеть ограничивает подключение — обратитесь в поддержку.
      </p>
      <div class="catalog-unavailable-actions">
        <button
          type="button"
          class="onboarding-next"
          disabled={busy()}
          onClick={retry}
        >
          Повторить загрузку
        </button>
        <button
          type="button"
          class="onboarding-secondary"
          aria-haspopup="dialog"
          onClick={() => setIsHelpOpen(true)}
        >
          Помощь
        </button>
      </div>
      <Show when={isHelpOpen()}>
        <HelpModal onClose={() => setIsHelpOpen(false)} />
      </Show>
    </>
  )

  if (!props.modal)
    return (
      <section
        class="catalog-unavailable"
        aria-labelledby={headingId}
        aria-busy={busy()}
      >
        {content()}
      </section>
    )

  return (
    <Show when={!dismissed()}>
      <ModalDialog headingId={headingId} busy={busy()} onClose={closeAndRetry}>
        {content}
      </ModalDialog>
    </Show>
  )
}

function ModalDialog(props: {
  headingId: string
  busy: boolean
  onClose: () => void
  children: (close: () => void) => JSX.Element
}) {
  let dialog!: HTMLDialogElement
  onMount(() => dialog.showModal())
  return (
    <dialog
      ref={dialog}
      class="catalog-unavailable catalog-unavailable-modal"
      aria-labelledby={props.headingId}
      aria-busy={props.busy}
      onClose={props.onClose}
      onPointerDown={(event) => closeOnBackdrop(event, dialog)}
    >
      {props.children(() => dialog.close())}
    </dialog>
  )
}
