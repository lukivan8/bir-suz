import {
  applyChallengeResult,
  buildChallengePayload,
  pickDueWord,
  shouldBlockForUserSettings,
} from './shared/challenge'
import { isRuntimeMessage } from './shared/messages'
import {
  defaultStorage,
  ensureStorage,
  getStorage,
  updateStorage,
} from './shared/storage'
import type { ChallengeResult, TriggerSource } from './shared/types'

const COMMAND_NAME = 'demo-trigger'
const LOG_PREFIX = '[Bir Söz background]'

function log(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`${LOG_PREFIX} ${message}`, details)
    return
  }

  console.log(`${LOG_PREFIX} ${message}`)
}

chrome.runtime.onInstalled.addListener(async (details) => {
  log('onInstalled', { reason: details.reason })
  if (details.reason === 'install') {
    await chrome.storage.local.set(defaultStorage)
    return
  }

  await ensureStorage()
})

chrome.runtime.onStartup.addListener(async () => {
  log('onStartup')
  await ensureStorage()
})

chrome.tabs.onCreated.addListener(async (tab) => {
  const storage = await getStorage()
  const nextCount = storage.newTabCount + 1
  await updateStorage({ newTabCount: nextCount })
  log('new tab created', {
    tabId: tab.id,
    url: tab.url,
    nextCount,
    frequency: storage.settings.frequency,
    newTabTriggerEnabled: storage.settings.newTabTriggerEnabled,
  })

  if (!storage.settings.newTabTriggerEnabled) {
    log('new-tab skipped: trigger disabled')
    return
  }
  if (nextCount % storage.settings.frequency !== 0) {
    log('new-tab skipped: frequency gate', { nextCount, frequency: storage.settings.frequency })
    return
  }

  if (shouldBlockForUserSettings(storage)) {
    log('new-tab skipped: user settings blocked', blockDetails(storage))
    return
  }
  if (!pickDueWord(storage.wordBank)) {
    log('new-tab skipped: no due word')
    return
  }

  const triggered = await maybeTriggerChallenge('new-tab')
  log('new-tab trigger attempt finished', { triggered })
  if (!triggered) {
    log('new-tab challenge pending until content script is ready')
    await updateStorage({ pendingTrigger: 'new-tab' })
  }
})

chrome.idle.onStateChanged.addListener(async (state) => {
  log('idle state changed', { state })
  if (state !== 'active') return

  const storage = await getStorage()
  if (!storage.settings.idleTriggerEnabled) {
    log('idle-return skipped: trigger disabled')
    return
  }

  const triggered = await maybeTriggerChallenge('idle-return')
  log('idle-return trigger attempt finished', { triggered })
})

chrome.commands.onCommand.addListener(async (command) => {
  log('command received', { command })
  if (command === COMMAND_NAME) {
    const triggered = await maybeTriggerChallenge('demo-hotkey', true)
    log('demo hotkey trigger attempt finished', { triggered })
  }
})

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    void (async () => {
      if (!isRuntimeMessage(message)) {
        log('ignored unknown runtime message')
        sendResponse({ ok: false })
        return
      }
      log('runtime message received', {
        type: message.type,
        senderTabId: _sender.tab?.id,
        senderUrl: _sender.url,
      })
      if (message.type === 'bir-soz:get-state') {
        sendResponse(await getStorage())
        return
      }

      if (message.type === 'bir-soz:content-ready') {
        const storage = await getStorage()
        log('content script ready', {
          senderTabId: _sender.tab?.id,
          pendingTrigger: storage.pendingTrigger,
        })
        if (storage.pendingTrigger) {
          const pendingTrigger = storage.pendingTrigger
          const triggered = await maybeTriggerChallenge(pendingTrigger)
          log('pending trigger attempt finished', {
            pendingTrigger,
            triggered,
          })
          await updateStorage({ pendingTrigger: null })
          log('pending trigger cleared', { pendingTrigger, triggered })
        }
        sendResponse({ ok: true })
        return
      }

      if (message.type === 'bir-soz:navigation-click') {
        const triggered = await handleNavigationClick(message.href, _sender.tab?.id, _sender.url)
        sendResponse({ triggered })
        return
      }

      if (message.type === 'bir-soz:submit-result') {
        await handleChallengeResult(message.payload)
        sendResponse({ ok: true })
        return
      }

      if (message.type === 'bir-soz:force-trigger') {
        const triggered = await maybeTriggerChallenge('demo-hotkey', true)
        sendResponse({ triggered })
        return
      }

      sendResponse({ ok: false })
    })()

    return true
  },
)

async function maybeTriggerChallenge(
  source: TriggerSource,
  bypassCooldown = false,
) {
  log('maybeTriggerChallenge started', { source, bypassCooldown })
  const storage = await getStorage()

  if (!bypassCooldown) {
    if (shouldBlockForUserSettings(storage)) {
      log('challenge blocked by user settings', { source, ...blockDetails(storage) })
      return false
    }
  }

  const word = pickDueWord(storage.wordBank)
  if (!word) {
    log('challenge blocked: no due word', { source, wordCount: storage.wordBank.length })
    return false
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  log('active tab resolved for challenge', { source, tabId: tab?.id, url: tab?.url })
  if (!tab?.id) {
    log('challenge blocked: no active tab id', { source })
    return false
  }
  if (!isEligiblePage(tab.url)) {
    log('challenge blocked: ineligible page', { source, url: tab.url })
    return false
  }

  const payload = buildChallengePayload(source, word)
  log('sending challenge to content script', { source, tabId: tab.id, wordId: word.id })

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'bir-soz:show-challenge',
      payload,
    })
    await updateStorage({
      userStats: {
        ...storage.userStats,
        lastChallengeAt: Date.now(),
      },
    })
    log('challenge sent successfully', { source, tabId: tab.id, wordId: word.id })
    return true
  } catch (error) {
    log('challenge send failed', {
      source,
      tabId: tab.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

function isEligiblePage(url?: string) {
  return url?.startsWith('http://') || url?.startsWith('https://')
}

async function handleNavigationClick(
  href: string | undefined,
  senderTabId: number | undefined,
  senderUrl: string | undefined,
) {
  const storage = await getStorage()
  const nextCount = storage.navigationCount + 1
  await updateStorage({ navigationCount: nextCount })
  log('navigation link click noted', {
    href,
    senderTabId,
    senderUrl,
    nextCount,
    frequency: storage.settings.frequency,
    navigationTriggerEnabled: storage.settings.navigationTriggerEnabled,
  })

  if (!storage.settings.navigationTriggerEnabled) {
    log('navigation skipped: trigger disabled')
    return false
  }
  if (nextCount < storage.settings.frequency) {
    log('navigation skipped: frequency gate', { nextCount, frequency: storage.settings.frequency })
    return false
  }

  if (shouldBlockForUserSettings(storage)) {
    await updateStorage({ navigationCount: 0, pendingTrigger: null })
    log('navigation threshold reached but skipped: user settings blocked; reset counter without queuing', {
      href,
      senderTabId,
      senderUrl,
      previousCount: nextCount,
      nextCount: 0,
      ...blockDetails(storage),
    })
    return false
  }

  await updateStorage({ navigationCount: 0, pendingTrigger: 'navigation' })
  log('navigation threshold reached: queued challenge for destination page and reset counter', {
    href,
    senderTabId,
    senderUrl,
    previousCount: nextCount,
    nextCount: 0,
  })
  return false
}

function blockDetails(storage: Awaited<ReturnType<typeof getStorage>>) {
  const now = Date.now()
  return {
    disabledUntil: storage.settings.disabledUntil,
    triggerOffRemainingMs: Math.max(0, (storage.settings.disabledUntil ?? 0) - now),
    quietHoursEnabled: storage.settings.quietHours.enabled,
    quietHours: storage.settings.quietHours,
    cooldownMinutes: storage.settings.cooldownMinutes,
    lastChallengeAt: storage.userStats.lastChallengeAt,
    cooldownRemainingMs: storage.userStats.lastChallengeAt
      ? Math.max(
          0,
          storage.userStats.lastChallengeAt +
            storage.settings.cooldownMinutes * 60 * 1000 -
            now,
        )
      : 0,
  }
}

async function handleChallengeResult(result: ChallengeResult) {
  log('challenge result received', {
    wordId: result.wordId,
    source: result.source,
    wasCorrect: result.wasCorrect,
    wasSkipped: result.wasSkipped,
    elapsedMs: result.elapsedMs,
  })
  const storage = await getStorage()
  await updateStorage(applyChallengeResult(storage, result))
  log('challenge result stored', { wordId: result.wordId })
}
