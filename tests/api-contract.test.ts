import { expect, test } from 'bun:test'
import fixtures from '../src/shared/protocol/fixtures.json'
import { mockCatalog } from '../src/shared/protocol/mock-transport'
import {
  type SchemaName,
  validateProtocol,
} from '../src/shared/protocol/validate'

test('fixtures match backend schemas and pass the identical runtime validator', async () => {
  for (const [name, value] of Object.values(fixtures))
    expect(validateProtocol(name as SchemaName, value)).toBe(true)
  for (const filename of ['schemas.json', 'fixtures.json']) {
    expect(
      await Bun.file(
        new URL(`../src/shared/protocol/${filename}`, import.meta.url),
      ).json(),
    ).toEqual(
      await Bun.file(
        new URL(`../../bir-stats/src/protocol/${filename}`, import.meta.url),
      ).json(),
    )
  }
})
test('generated validators match backend exactly', async () => {
  expect(
    await Bun.file(
      new URL('../src/shared/protocol/validators.js', import.meta.url),
    ).text(),
  ).toEqual(
    await Bun.file(
      new URL('../../bir-stats/src/protocol/validators.js', import.meta.url),
    ).text(),
  )
})
test('typed mock catalogs and bodyless 304', () => {
  for (const gated of [false, true]) {
    const response = mockCatalog(gated)
    expect(response.status).toBe(200)
    if (response.status === 200)
      expect(response.body.vocabularies).toHaveLength(gated ? 4 : 3)
    expect(mockCatalog(gated, response.etag)).toEqual({
      status: 304,
      etag: response.etag,
    })
  }
})

test('mock works with MV3-style prohibition on runtime code generation', () => {
  const source = new URL(
    '../src/shared/protocol/mock-transport.ts',
    import.meta.url,
  ).pathname
  const result = Bun.spawnSync([
    process.execPath,
    '-e',
    `
    globalThis.Function = new Proxy(Function, { construct() { throw new Error('CSP blocks code generation') }, apply() { throw new Error('CSP blocks code generation') } });
    const { mockCatalog } = await import(${JSON.stringify(source)});
    for (const gated of [false, true]) {
      const r = mockCatalog(gated);
      if (r.status !== 200 || r.body.vocabularies.length !== (gated ? 4 : 3)) throw new Error('Invalid catalog');
      if ('body' in mockCatalog(gated, r.etag)) throw new Error('304 has body');
    }
  `,
  ])
  expect(result.exitCode).toBe(0)
})
