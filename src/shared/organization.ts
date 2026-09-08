import { API_ORIGIN } from './api-client'
import type { ConnectResponse, ProtocolError } from './api-contract'
import { syncCatalog } from './catalog-sync'
import { assertProtocol, validateProtocol } from './protocol/validate'
import { getClientUuid, persistLearningTransition } from './stats'
import { getStorage, withStorageLock } from './storage'

export type ConnectResult = { ok: true } | { ok: false; error: string }

const errorMessages: Record<string, string> = {
  CODE_NOT_FOUND: 'Код организации не найден. Проверьте код.',
  CODE_DISABLED: 'Организация больше не активна. Обратитесь к организатору.',
}

export async function requestOrganization(
  installationId: string,
  code: string,
  transport: typeof fetch = fetch,
): Promise<ConnectResponse> {
  let response: Response
  try {
    response = await transport(`${API_ORIGIN}/api/v1/organization/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ installationId, code: code.trim() }),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new Error(
      'Нет связи с сервером. Проверьте сеть и повторите подключение.',
    )
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('Сервер не смог подключить организацию. Повторите позже.')
  }
  if (!response.ok) {
    const error = validateProtocol('ProtocolError', body)
      ? (body as ProtocolError).error.code
      : ''
    throw new Error(
      errorMessages[error] ??
        'Сервер не смог подключить организацию. Повторите позже.',
    )
  }
  try {
    assertProtocol('ConnectResponse', body)
  } catch {
    throw new Error('Некорректный ответ сервера. Повторите позже.')
  }
  return body as ConnectResponse
}

export async function connectOrganization(
  code: string,
): Promise<ConnectResult> {
  return navigator.locks.request('bir-soz-connect', async () => {
    const trimmed = code.trim()
    if (!trimmed || trimmed.length > 200)
      return { ok: false, error: 'Введите код организации (до 200 символов).' }
    const current = await getStorage()
    if (current.organization) {
      if (current.organization.code.toUpperCase() !== trimmed.toUpperCase())
        return { ok: false, error: 'Организация уже подключена.' }
      await syncCatalog()
      return { ok: true }
    }
    try {
      const response = await requestOrganization(await getClientUuid(), trimmed)
      await withStorageLock(async () => {
        const current = await getStorage()
        await persistLearningTransition(current, {
          ...current,
          organization: response.organization,
          catalogEtag: null,
        })
      })
      await syncCatalog()
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось подключиться. Повторите позже.',
      }
    }
  })
}
