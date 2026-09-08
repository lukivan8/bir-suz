import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const mechanisms = {
  'Catalog GET, credentials omitted, response validation': [
    'fetchCatalog',
    '/api/v1/vocabularies',
  ],
  'Organization POST, operational (no learning consent required)': [
    'requestOrganization',
    '/api/v1/organization/connect',
  ],
  'Opt-in batch delivery and abort on opt-out': [
    'flushStats',
    '/api/v1/analytics/events/batch',
    'analyticsEnabled',
  ],
  'Minimized learning event builders': ['transitionEvents'],
  'Content-script outbound messages': [
    'bir-soz:content-ready',
    'bir-soz:page-activity',
    'bir-soz:submit-result',
  ],
  'Background sender/command boundary': ['allowsBackgroundMessage'],
  'Data-only catalog merge, SRS retained by ID': ['mergeRemoteCatalog'],
  'Runtime schema validation': ['validateProtocol'],
  'Catalog and analytics alarms': [
    'bir-soz-catalog-sync',
    'bir-soz-stats-flush',
  ],
}
async function files(root) {
  const result = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) result.push(...(await files(path)))
    else result.push(path)
  }
  return result
}
export async function generateReviewPackage(outDir) {
  const paths = await files(outDir)
  const scripts = await Promise.all(
    paths
      .filter((p) => p.endsWith('.js'))
      .map(async (p) => ({
        path: relative(outDir, p),
        text: await readFile(p, 'utf8'),
      })),
  )
  const lines = [
    'Bir Soz executable code map (generated from this build)',
    'Paths are relative to the ZIP root. Search the listed literal markers.',
    'JavaScript is bundled locally and deliberately not minified.',
    '',
  ]
  for (const [purpose, markers] of Object.entries(mechanisms)) {
    lines.push(purpose)
    for (const marker of markers) {
      const matches = scripts.filter((f) => f.text.includes(marker))
      if (!matches.length) throw new Error(`Missing review marker: ${marker}`)
      lines.push(`  ${marker}: ${matches.map((f) => f.path).join(', ')}`)
    }
  }
  const schemas = JSON.parse(
    await readFile(
      new URL('../src/shared/protocol/schemas.json', import.meta.url),
      'utf8',
    ),
  )
  const names = new Set([
    'ConnectRequest',
    'ConnectResponse',
    'RemoteVocabularyCatalog',
    'AnalyticsBatchRequest',
    'AnalyticsBatchResponse',
    'ProtocolError',
  ])
  for (const name of names) {
    for (const match of JSON.stringify(schemas[name]).matchAll(
      /#\/components\/schemas\/([^"\s]+)/g,
    ))
      names.add(match[1])
  }
  const selected = Object.fromEntries(
    [...names].sort().map((name) => [name, schemas[name]]),
  )
  const notes = await readFile(
    join(outDir, 'review/analytics-api-contract.txt'),
    'utf8',
  )
  const sourcePaths = ['api-client.ts', 'organization.ts', 'stats.ts']
  const endpoints = new Set()
  for (const path of sourcePaths) {
    const source = await readFile(
      new URL(`../src/shared/${path}`, import.meta.url),
      'utf8',
    )
    for (const match of source.matchAll(/\$\{API_ORIGIN\}(\/api[^`]+)/g))
      endpoints.add(match[1])
  }
  for (const endpoint of endpoints)
    if (!notes.includes(endpoint))
      throw new Error(`Undocumented endpoint: ${endpoint}`)
  for (const match of notes.matchAll(/\/api\/v1\/[a-z/]+/g))
    if (!endpoints.has(match[0])) throw new Error(`Stale endpoint: ${match[0]}`)
  await mkdir(join(outDir, 'review'), { recursive: true })
  await writeFile(join(outDir, 'review/code-map.txt'), `${lines.join('\n')}\n`)
  await writeFile(
    join(outDir, 'review/api-schemas.json'),
    `${JSON.stringify({ components: { schemas: selected } }, null, 2)}\n`,
  )
}
