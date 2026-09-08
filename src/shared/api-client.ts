import type { RemoteVocabularyCatalog } from './api-contract'
import { assertProtocol } from './protocol/validate'

export const API_ORIGIN =
  import.meta.env?.['VITE_BIR_API_ORIGIN'] || 'https://api.lukivan8.com'
export type CatalogResponse =
  | { status: 304 }
  | { status: 200; etag: string | null; catalog: RemoteVocabularyCatalog }

export async function fetchCatalog(
  code: string | undefined,
  etag: string | null,
  transport: typeof fetch = fetch,
): Promise<CatalogResponse> {
  const headers: Record<string, string> = {}
  if (code) headers['X-Bir-Organization-Code'] = code
  if (etag) headers['If-None-Match'] = etag
  const response = await transport(`${API_ORIGIN}/api/v1/vocabularies`, {
    headers,
    credentials: 'omit',
    cache: 'no-cache',
    signal: AbortSignal.timeout(15000),
  })
  if (response.status === 304) return { status: 304 }
  if (!response.ok) throw new Error('Catalog request failed')
  const catalog: unknown = await response.json()
  assertProtocol('RemoteVocabularyCatalog', catalog)
  return {
    status: 200,
    etag: response.headers.get('ETag'),
    catalog: catalog as RemoteVocabularyCatalog,
  }
}
