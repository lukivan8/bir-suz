import { createSignal, Show } from 'solid-js'
import type { ConnectResult } from '../shared/organization'

export function OrganizationForm(props: { onConnected: () => void }) {
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
      <p id="organization-code-description">
        Код активирует дополнительные возможности вашей организации, включая
        доступ к дополнительным словарям. Если у вас нет кода, этот шаг можно
        пропустить.
      </p>
      <label>
        Код организации
        <input
          class="w-full border border-rule bg-paper px-3 py-2"
          aria-describedby="organization-code-description"
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
