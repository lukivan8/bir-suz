import type { RemoteVocabularyCatalog } from '../api-contract'
import fixtures from './fixtures.json'
import { assertProtocol } from './validate'

export function mockCatalog(
  organizationEnabled = false,
  ifNoneMatch?: string,
):
  | { status: 304; etag: string }
  | { status: 200; etag: string; body: RemoteVocabularyCatalog } {
  const etag = organizationEnabled
    ? '"fixture-organization-1"'
    : '"fixture-public-1"'
  if (etag === ifNoneMatch) return { status: 304, etag }
  const key = organizationEnabled ? 'catalog-organization' : 'catalog-public'
  const body = structuredClone(fixtures[key][1])
  assertProtocol('RemoteVocabularyCatalog', body)
  return { status: 200, etag, body: body as RemoteVocabularyCatalog }
}
