/** Closes a modal <dialog> when the pointer goes down on its backdrop. */
export function closeOnBackdrop(
  event: PointerEvent,
  dialog: HTMLDialogElement,
) {
  if (event.target !== dialog) return
  const box = dialog.getBoundingClientRect()
  const inside =
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom
  if (!inside) dialog.close()
}
