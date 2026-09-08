import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { allowsBackgroundMessage } from '../src/shared/message-access'
import { isRuntimeMessage, type RuntimeMessage } from '../src/shared/messages'

const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const content: chrome.runtime.MessageSender = {
  id,
  tab: { id: 7 } as chrome.tabs.Tab,
  frameId: 0,
}
const ui: chrome.runtime.MessageSender = {
  id,
  url: `chrome-extension://${id}/dashboard.html`,
}
test('privileged commands are isolated from content scripts and foreign senders', () => {
  for (const message of [
    { type: 'bir-soz:get-state' },
    { type: 'bir-soz:sync-catalog' },
    { type: 'bir-soz:connect-organization', code: 'synthetic' },
    { type: 'bir-soz:study', payload: { action: 'start', onboarding: false } },
    { type: 'bir-soz:force-trigger' },
  ] as RuntimeMessage[]) {
    assert.equal(allowsBackgroundMessage(message, content, id), false)
    assert.equal(
      allowsBackgroundMessage(message, { ...ui, id: 'foreign' }, id),
      false,
    )
    assert.equal(
      allowsBackgroundMessage(
        message,
        { ...ui, url: `chrome-extension://${id}/unknown.html` },
        id,
      ),
      false,
    )
    assert.equal(allowsBackgroundMessage(message, ui, id), true)
    assert.equal(
      allowsBackgroundMessage(
        message,
        { ...ui, url: `chrome-extension://${id}/index.html` },
        id,
      ),
      true,
    )
  }
})
test('page activity requires same extension top frame and tab; malformed payloads rejected', () => {
  for (const type of [
    'bir-soz:content-ready',
    'bir-soz:page-activity',
  ] as const) {
    assert.equal(allowsBackgroundMessage({ type }, content, id), true)
    assert.equal(allowsBackgroundMessage({ type }, ui, id), false)
    assert.equal(
      allowsBackgroundMessage({ type }, { ...content, frameId: 1 }, id),
      false,
    )
    assert.equal(
      allowsBackgroundMessage({ type }, { ...content, id: undefined }, id),
      false,
    )
  }
  assert.equal(
    isRuntimeMessage({ type: 'bir-soz:study', payload: null }),
    false,
  )
  assert.equal(
    isRuntimeMessage({
      type: 'bir-soz:submit-result',
      payload: { elapsedMs: -1 },
    }),
    false,
  )
  assert.equal(
    isRuntimeMessage({ type: 'arbitrary-fetch', url: 'https://example.com' }),
    false,
  )
})
