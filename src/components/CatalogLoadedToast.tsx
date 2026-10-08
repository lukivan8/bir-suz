import { createEffect, on, onCleanup } from 'solid-js'

const VISIBLE_MS = 2600

/** Briefly confirms that vocabularies arrived after they had been missing. */
export function CatalogLoadedToast(props: { loaded: boolean }) {
  let toast!: HTMLDivElement
  let wasMissing = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const hide = () => {
    if (toast.matches(':popover-open')) toast.hidePopover()
  }
  createEffect(
    on(
      () => props.loaded,
      (loaded) => {
        if (!loaded) {
          wasMissing = true
          return
        }
        if (!wasMissing) return
        wasMissing = false
        clearTimeout(timer)
        hide()
        toast.showPopover()
        timer = setTimeout(hide, VISIBLE_MS)
      },
    ),
  )
  onCleanup(() => clearTimeout(timer))
  return (
    <div ref={toast} popover="manual" class="catalog-toast" role="status">
      Словари загружены
    </div>
  )
}
