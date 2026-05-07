import { calculateNextSrs, isDue, qualityFromResult } from './shared/srs'
import {
  defaultStorage,
  ensureStorage,
  getStorage,
  updateStorage,
} from './shared/storage'
import type {
  ChallengePayload,
  ChallengeResult,
  TriggerSource,
  WordItem,
} from './shared/types'

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

  if (isDisabled(storage.settings.disabledUntil)) return
  if (isQuietTime(storage.settings)) return
  if (
    isCoolingDown(
      storage.userStats.lastChallengeAt,
      storage.settings.cooldownMinutes,
    )
  )
    return
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
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
      await handleChallengeResult(message.payload as ChallengeResult)
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
})

async function maybeTriggerChallenge(
  source: TriggerSource,
  bypassCooldown = false,
) {
  const storage = await getStorage()

  if (!bypassCooldown) {
    if (isDisabled(storage.settings.disabledUntil)) return false
    if (isQuietTime(storage.settings)) return false
    if (
      isCoolingDown(
        storage.userStats.lastChallengeAt,
        storage.settings.cooldownMinutes,
      )
    )
      return false
  }

  const word = pickDueWord(storage.wordBank)
  if (!word) return false

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !isEligiblePage(tab.url)) return false

  const payload: ChallengePayload = {
    source,
    word,
    options: shuffle([
      word.targetText,
      ...shuffle(word.distractors).slice(0, 3),
    ]),
    startedAt: Date.now(),
  }

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
  const now = Date.now()
  const nextWords = storage.wordBank.map((word) => {
    if (word.id !== result.wordId) return word
    return {
      ...word,
      srs: calculateNextSrs(word.srs, qualityFromResult(result), now),
    }
  })

  const nextStats = {
    ...storage.userStats,
    totalExposures: storage.userStats.totalExposures + 1,
    totalCorrect: storage.userStats.totalCorrect + (result.wasCorrect ? 1 : 0),
    timeInLanguageContactMs:
      storage.userStats.timeInLanguageContactMs + result.elapsedMs,
  }

  await updateStorage({ wordBank: nextWords, userStats: nextStats })
}

function pickDueWord(words: WordItem[]) {
  const dueWords = words.filter((word) => isDue(word.srs.nextReview))
  const candidates = dueWords.length > 0 ? dueWords : words
  return randomItem(candidates)
}

function randomItem<T>(items: T[]) {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

function isCoolingDown(
  lastChallengeAt: number | undefined,
  cooldownMinutes: number,
) {
  if (!lastChallengeAt) return false
  return Date.now() - lastChallengeAt < cooldownMinutes * 60 * 1000
}

function isDisabled(disabledUntil?: number) {
  return typeof disabledUntil === 'number' && disabledUntil > Date.now()
}

function isQuietTime(settings: typeof defaultStorage.settings) {
  if (!settings.quietHours.enabled) return false
  const hour = new Date().getHours()
  const { startHour, endHour } = settings.quietHours

  if (startHour < endHour) {
    return hour >= startHour && hour < endHour
  }

  return hour >= startHour || hour < endHour
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}
