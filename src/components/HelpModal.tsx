import { createUniqueId, onMount } from 'solid-js'
import { closeOnBackdrop } from './dialog'
import { SupportLink } from './SupportLink'

export function HelpModal(props: { onClose: () => void }) {
  let dialog!: HTMLDialogElement
  const headingId = createUniqueId()
  onMount(() => dialog.showModal())

  return (
    <dialog
      ref={dialog}
      class="advanced-modal word-modal help-modal"
      aria-labelledby={headingId}
      onClose={props.onClose}
      onPointerDown={(event) => closeOnBackdrop(event, dialog)}
    >
      <button type="button" class="modal-close" onClick={() => dialog.close()}>
        закрыть
      </button>
      <h2 id={headingId} class="section-heading">
        Помощь
      </h2>
      <p>
        Если что-то не работает или есть вопрос, напишите нам — поможем
        разобраться.
      </p>
      <SupportLink />
    </dialog>
  )
}
