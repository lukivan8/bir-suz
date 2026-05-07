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

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set(defaultStorage)
    return
  }

  await ensureStorage()
})

chrome.runtime.onStartup.addListener(async () => {
  await ensureStorage()
})

chrome.tabs.onCreated.addListener(async () => {
  const storage = await getStorage()
  const nextCount = storage.newTabCount + 1
  await updateStorage({ newTabCount: nextCount })

  if (!storage.settings.newTabTriggerEnabled) return
  if (nextCount % storage.settings.frequency !== 0) return

  if (shouldBlockForUserSettings(storage)) return
  if (!pickDueWord(storage.wordBank)) return

  const triggered = await maybeTriggerChallenge('new-tab')
  if (!triggered) {
    await updateStorage({ pendingTrigger: 'new-tab' })
  }
})

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state !== 'active') return

  const storage = await getStorage()
  if (!storage.settings.idleTriggerEnabled) return

  await maybeTriggerChallenge('idle-return')
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === COMMAND_NAME) {
    await maybeTriggerChallenge('demo-hotkey', true)
  }
})

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    void (async () => {
      if (!isRuntimeMessage(message)) {
        sendResponse({ ok: false })
        return
      }
      if (message.type === 'bir-soz:get-state') {
        sendResponse(await getStorage())
        return
      }

      if (message.type === 'bir-soz:content-ready') {
        const storage = await getStorage()
        if (storage.pendingTrigger) {
          const triggered = await maybeTriggerChallenge(storage.pendingTrigger)
          if (triggered) {
            await updateStorage({ pendingTrigger: undefined })
          }
        }
        sendResponse({ ok: true })
        return
      }

      if (message.type === 'bir-soz:navigation-click') {
        const triggered = await handleNavigationClick()
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
  const storage = await getStorage()

  if (!bypassCooldown) {
    if (shouldBlockForUserSettings(storage)) return false
  }

  const word = pickDueWord(storage.wordBank)
  if (!word) return false

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !isEligiblePage(tab.url)) return false

  const payload = buildChallengePayload(
    source,
    word,
    storage.settings.overlayTheme,
  )

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
    return true
  } catch {
    return false
  }
}

function isEligiblePage(url?: string) {
  return url?.startsWith('http://') || url?.startsWith('https://')
}

async function handleNavigationClick() {
  const storage = await getStorage()
  const nextCount = storage.navigationCount + 1
  await updateStorage({ navigationCount: nextCount })

  if (!storage.settings.navigationTriggerEnabled) return false
  if (nextCount % storage.settings.frequency !== 0) return false

  return maybeTriggerChallenge('navigation')
}

async function handleChallengeResult(result: ChallengeResult) {
  const storage = await getStorage()
  await updateStorage(applyChallengeResult(storage, result))
}
