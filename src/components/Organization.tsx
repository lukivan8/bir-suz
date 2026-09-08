import { createSignal, Show } from 'solid-js'
import type { ConnectResponse } from '../shared/api-contract'
import type { ConnectResult } from '../shared/organization'

export function OrganizationSection(props: {
  organization: ConnectResponse['organization'] | null
  onConnected?: () => void
}) {
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
        props.onConnected?.()
      } else setError(result.error)
    } catch {
      setError('Не удалось подключиться. Повторите позже.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section class="activity-panel" aria-label="Организация">
      <h2 class="section-heading">Организация</h2>
      <Show
        when={props.organization}
        fallback={
          <form onSubmit={connect} class="grid gap-2">
            <label>
              Код организации
              <input
                class="w-full border border-rule bg-paper px-3 py-2"
                value={code()}
                onInput={(e) => setCode(e.currentTarget.value)}
                maxLength={200}
                autocomplete="off"
              />
            </label>
            <button
              class="dashboard-settings-button"
              type="submit"
              disabled={busy()}
            >
              {busy() ? 'Подключение…' : 'Подключить'}
            </button>
            <Show when={error()}>
              <p role="alert">{error()}</p>
            </Show>
          </form>
        }
      >
        {(organization) => (
          <p>
            {organization().name} · Код: {organization().code}
          </p>
        )}
      </Show>
    </section>
  )
}
