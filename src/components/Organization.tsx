import { createSignal, createUniqueId, Show } from 'solid-js'
import type { ConnectResult } from '../shared/organization'

export function OrganizationForm(props: {
  onConnected: () => void
  description?: string
}) {
  const descriptionId = createUniqueId()
  const [code, setCode] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  async function connect(event: SubmitEvent) {
    event.preventDefault()
    if (busy()) return
    setBusy(true)
    setError('')
    try {
      const result: ConnectResult = await chrome.runtime.sendMessage({
        type: 'bir-soz:connect-organization',
        code: code(),
      })
      if (result.ok) {
        setCode('')
        props.onConnected()
      } else setError(result.error)
    } catch {
      setError('Не удалось подключиться. Повторите позже.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={connect} class="grid gap-2">
      <p id={descriptionId}>
        {props.description ??
          'Код активирует дополнительные возможности вашей организации, включая доступ к дополнительным словарям. Если у вас нет кода, этот шаг можно пропустить.'}
      </p>
      <p class="modal-note">
        При подключении на сервер передаются код и случайный идентификатор
        установки, даже если статистика выключена. В публичной аналитике
        организации видны псевдоним установки и дата подключения; при включённой
        статистике — также дата последнего выполненного задания.{' '}
        <a
          href="https://api.lukivan8.com/privacy"
          target="_blank"
          rel="noreferrer"
        >
          Политика конфиденциальности
        </a>
      </p>
      <label>
        Код организации
        <input
          class="w-full border border-rule bg-paper px-3 py-2"
          aria-describedby={descriptionId}
          value={code()}
          onInput={(e) => setCode(e.currentTarget.value)}
          maxLength={200}
          autocomplete="off"
        />
      </label>
      <button class="onboarding-next" type="submit" disabled={busy()}>
        {busy() ? 'Подключение…' : 'Подключить'}
      </button>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
    </form>
  )
}
