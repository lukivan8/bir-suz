import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateReviewPackage } from '../scripts/review-package.mjs'

test('built review map resolves executable paths; broken markers and stale endpoints fail', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bir-review-'))
  try {
    await cp(new URL('../dist/', import.meta.url), dir, { recursive: true })
    await generateReviewPackage(dir)
    const text = await readFile(join(dir, 'review/code-map.txt'), 'utf8')
    assert.ok(text.includes('allowsBackgroundMessage'))
    const match = text.match(/allowsBackgroundMessage: (.+)/)
    assert.ok(match)
    const path = join(dir, match[1].split(', ')[0])
    const original = await readFile(path, 'utf8')
    await writeFile(
      path,
      original.replaceAll('allowsBackgroundMessage', 'removedBoundary'),
    )
    await assert.rejects(generateReviewPackage(dir), /Missing review marker/)
    await writeFile(path, original)
    const notes = join(dir, 'review/analytics-api-contract.txt')
    await writeFile(notes, `${await readFile(notes, 'utf8')}\n/api/v1/stale\n`)
    await assert.rejects(generateReviewPackage(dir), /Stale endpoint/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
