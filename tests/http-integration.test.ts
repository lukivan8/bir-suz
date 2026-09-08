import { Database } from 'bun:sqlite'
import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RemoteVocabularyCatalog } from '../src/shared/api-contract'
import { validateProtocol } from '../src/shared/protocol/validate'
import {
  mergeRemoteCatalog,
  PUBLIC_VOCABULARY_IDS,
} from '../src/shared/remote-model'
import { normalizeStorage } from '../src/shared/storage'

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return address.port
}

test('real HTTP backend on temporary SQLite matches extension, dynamic catalog and analytics contract', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bir-http-integration-'))
  const backend = new URL('../../bir-stats/', import.meta.url).pathname
  const databasePath = join(directory, 'test.sqlite')
  const port = await freePort(),
    origin = `http://127.0.0.1:${port}`
  const launch = () =>
    Bun.spawn([process.execPath, 'run', 'src/index.ts'], {
      cwd: backend,
      env: {
        ...process.env,
        DB_PATH: databasePath,
        SQLITE_MIGRATE_PATH: '',
        PORT: String(port),
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })
  let server = launch()
  const request = (path: string, init?: RequestInit) =>
    fetch(origin + path, { ...init, signal: AbortSignal.timeout(5000) })
  const post = (path: string, body: unknown) =>
    request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  const ready = async () => {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await request('/api')).ok) return
      } catch {}
      if (server.exitCode !== null) throw Error('Temporary HTTP backend exited')
      await Bun.sleep(50)
    }
    throw Error('Temporary HTTP backend readiness timeout')
  }
  const code = 'SYNTHETIC-HTTP',
    installationId = '00000000-0000-4000-8000-000000000001'
  const headers = { 'X-Bir-Organization-Code': code }
  const catalog = async (gated = false) => {
    const r = await request(
      '/api/v1/vocabularies',
      gated ? { headers } : undefined,
    )
    assert.equal(r.status, 200)
    const b = await r.json()
    assert.equal(validateProtocol('RemoteVocabularyCatalog', b), true)
    return b as RemoteVocabularyCatalog
  }
  const upload = async (path: string, filename: string, name?: string) => {
    const form = new FormData()
    form.set(
      'file',
      new File(
        [
          await Bun.file(
            join(backend, 'tests/fixtures', filename),
          ).arrayBuffer(),
        ],
        filename,
      ),
    )
    if (name) form.set('name', name)
    return request(path, { method: 'POST', body: form })
  }
  try {
    await ready()
    const cold = normalizeStorage({})
    assert.equal(cold.vocabularies.length, 0)
    const response = await request('/api/v1/vocabularies'),
      publicCatalog = (await response.json()) as RemoteVocabularyCatalog
    assert.equal(
      validateProtocol('RemoteVocabularyCatalog', publicCatalog),
      true,
    )
    assert.deepEqual(
      publicCatalog.vocabularies.map((v) => v.id),
      Object.values(PUBLIC_VOCABULARY_IDS),
    )
    const etag = response.headers.get('etag')
    assert.ok(etag)
    const cached = await request('/api/v1/vocabularies', {
      headers: { 'If-None-Match': etag },
    })
    assert.equal(cached.status, 304)
    assert.equal(await cached.text(), '')
    const broken = structuredClone(publicCatalog)
    delete (broken.vocabularies[0] as Partial<(typeof broken.vocabularies)[0]>)
      .level
    assert.equal(validateProtocol('RemoteVocabularyCatalog', broken), false)
    const created = await post('/api/v1/organizations', {
      name: 'Synthetic HTTP',
      code,
    })
    assert.equal(created.status, 201)
    const organization = await created.json()
    assert.equal(validateProtocol('Organization', organization), true)
    assert.equal(
      (
        await post('/api/v1/organizations', {
          name: 'Conflict',
          code: code.toLowerCase(),
        })
      ).status,
      409,
    )
    for (let i = 0; i < 2; i++) {
      const connected = await post('/api/v1/organization/connect', {
        installationId,
        code,
      })
      assert.equal(connected.status, 200)
      assert.equal(
        validateProtocol('ConnectResponse', await connected.json()),
        true,
      )
    }
    const orgs = await (await request('/api/v1/organizations')).json()
    assert.equal(orgs.organizations[0].connectedInstallations, 1)
    const gated = await catalog(true)
    assert.equal(gated.vocabularies.length, 4)
    const madeResponse = await upload(
      '/api/v1/vocabularies',
      'verbs-valid.xlsx',
      'Synthetic dynamic',
    )
    assert.equal(madeResponse.status, 201)
    const made = await madeResponse.json()
    assert.equal(validateProtocol('ImportResponse', made), true)
    const dynamic = await catalog(true)
    assert.equal(dynamic.vocabularies.length, 5)
    let local = mergeRemoteCatalog(
      {
        ...cold,
        organization: {
          id: organization.id,
          name: organization.name,
          code: organization.code,
        },
      },
      dynamic,
    )
    const vocabulary = local.vocabularies.find(
      (v) => v.id === made.vocabularyId,
    )
    assert.ok(vocabulary)
    vocabulary.words[0].srs.repetition = 7
    const beforeVersion = vocabulary.remoteVersion
    const updated = await upload(
      `/api/v1/vocabularies/${made.vocabularyId}/import`,
      'verbs-valid.xlsx',
    )
    assert.equal(updated.status, 200)
    local = mergeRemoteCatalog(local, await catalog(true))
    const updatedVocabulary = local.vocabularies.find(
      (v) => v.id === made.vocabularyId,
    )
    assert.ok(updatedVocabulary)
    assert.equal(updatedVocabulary.remoteVersion, (beforeVersion ?? 0) + 1)
    assert.equal(updatedVocabulary.words[0].srs.repetition, 7)
    const beforeInvalid = await catalog(true)
    assert.equal(
      (
        await upload(
          `/api/v1/vocabularies/${made.vocabularyId}/import`,
          'verbs-invalid.xlsx',
        )
      ).status,
      400,
    )
    assert.deepEqual(await catalog(true), beforeInvalid)
    const vocabularyId = PUBLIC_VOCABULARY_IDS[0],
      wordId = publicCatalog.vocabularies[0].words[0].id
    const events = [120000, 120001, 3600000].map((durationMs, i) => ({
      id: `synthetic-http-${i}`,
      installationId,
      organizationId: organization.id,
      type: 'challenge_completed',
      occurredAt: Date.now(),
      vocabularyId,
      wordId,
      correct: true,
      durationMs,
    }))
    const batch = await (
      await post('/api/v1/analytics/events/batch', { events })
    ).json()
    assert.equal(validateProtocol('AnalyticsBatchResponse', batch), true)
    assert.equal(batch.accepted, 3)
    const retry = await (
      await post('/api/v1/analytics/events/batch', { events })
    ).json()
    assert.equal(retry.accepted, 0)
    assert.equal(retry.duplicates, 3)
    const metrics = await (await request('/dashboard')).text()
    assert.match(metrics, /data-metric="learningHours">0,04</)
    assert.match(metrics, /data-metric="challengesCompleted">3</)
    assert.equal(metrics.includes(installationId), false)
    assert.equal(metrics.includes(databasePath), false)
    const db = new Database(databasePath, { readonly: true })
    try {
      const rows = db
        .query('SELECT payload_json FROM analytics_events_v2 ORDER BY id')
        .all() as { payload_json: string }[]
      assert.deepEqual(
        rows.map((r) => JSON.parse(r.payload_json).durationMs),
        [120000, 120001, 3600000],
      )
    } finally {
      db.close()
    }
    const archived = await request(`/api/v1/organizations/${organization.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    assert.equal(archived.status, 200)
    const revoked = await catalog(true)
    assert.equal(revoked.vocabularies.length, 3)
    local = mergeRemoteCatalog(local, revoked)
    assert.equal(
      local.remoteArchive.find((v) => v.id === made.vocabularyId)?.words[0].srs
        .repetition,
      7,
    )
    server.kill()
    await server.exited
    assert.equal(normalizeStorage(local).vocabularies.length, 3)
    server = launch()
    await ready()
    assert.deepEqual(await catalog(), publicCatalog)
    const afterRestart = await (
      await post('/api/v1/analytics/events/batch', { events })
    ).json()
    assert.equal(afterRestart.duplicates, 3)
  } finally {
    server.kill()
    await server.exited
    await rm(directory, { recursive: true, force: true })
  }
}, 30000)
