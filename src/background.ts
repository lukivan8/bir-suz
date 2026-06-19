import {
  applyChallengeResult,
  buildChallengePayload,
  pickDueWord,
  shouldBlockForUserSettings,
} from './shared/challenge'
import { isRuntimeMessage } from './shared/messages'
import {
  flushStatsQueueFromTimer,
  recordChallengeEvent,
  recordSettingsEvent,
  syncStatsInBackground,
} from './shared/stats'
import {
  defaultStorage,
  ensureStorage,
  getStorage,
  updateStorage,
} from './shared/storage'
import type { ChallengeResult, TriggerSource } from './shared/types'
import { getActiveWords } from './shared/vocabularies'

const COMMAND_NAME = 'demo-trigger'
const STATS_FLUSH_ALARM_NAME = 'bir-soz-stats-flush'
const STATS_FLUSH_PERIOD_MINUTES = 1
const LOG_PREFIX = '[Bir Söz background]'
const readyContentTabs = new Set<number>()

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
    await ensureStatsFlushAlarm()
    syncStatsInBackground(defaultStorage)
    await chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html?welcome=analytics'),
    })
    return
  }

  await ensureStorage()
  await ensureStatsFlushAlarm()
  syncStatsInBackground(await getStorage())
})

chrome.runtime.onStartup.addListener(async () => {
  log('onStartup')
  await ensureStorage()
  await ensureStatsFlushAlarm()
  syncStatsInBackground(await getStorage())
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== STATS_FLUSH_ALARM_NAME) return

  void (async () => {
    log('stats flush alarm fired')
    flushStatsQueueFromTimer(await getStorage())
  })()
})

chrome.tabs.onCreated.addListener(async (tab) => {
  const storage = await getStorage()
  const nextCount = storage.newTabCount + 1
  await updateStorage({ newTabCount: nextCount })
  log('new tab created', {
    tabId: tab.id,
    nextCount,
    frequency: storage.settings.frequency,
    newTabTriggerEnabled: storage.settings.newTabTriggerEnabled,
  })

  if (!storage.settings.newTabTriggerEnabled) {
    log('new-tab skipped: trigger disabled')
    return
  }
  if (nextCount % storage.settings.frequency !== 0) {
    log('new-tab skipped: frequency gate', {
      nextCount,
      frequency: storage.settings.frequency,
    })
    return
  }

  if (shouldBlockForUserSettings(storage)) {
    log('new-tab skipped: user settings blocked', blockDetails(storage))
    return
  }
  if (!pickDueWord(getActiveWords(storage))) {
    log('new-tab skipped: no due word')
    return
  }

  log('new-tab challenge queued until an eligible content script is ready')
  await updateStorage({ pendingTrigger: 'new-tab' })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  readyContentTabs.delete(tabId)
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
      })
      if (message.type === 'bir-soz:get-state') {
        sendResponse(await getStorage())
        return
      }

      if (message.type === 'bir-soz:content-ready') {
        if (_sender.tab?.id) {
          readyContentTabs.add(_sender.tab.id)
        }
        const storage = await getStorage()
        log('content script ready', {
          senderTabId: _sender.tab?.id,
          pendingTrigger: storage.pendingTrigger,
          readyContentTabs: readyContentTabs.size,
        })
        if (storage.pendingTrigger) {
          const pendingTrigger = storage.pendingTrigger
          const triggered = await maybeTriggerChallenge(
            pendingTrigger,
            false,
            _sender.tab?.id,
          )
          log('pending trigger attempt finished', {
            pendingTrigger,
            triggered,
          })
          if (triggered) {
            await updateStorage({ pendingTrigger: null })
            log('pending trigger cleared', { pendingTrigger, triggered })
          }
        }
        sendResponse({ ok: true })
        return
      }

      if (message.type === 'bir-soz:page-activity') {
        const triggered = await handlePageActivity(_sender.tab?.id)
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

      if (message.type === 'bir-soz:stats-event') {
        await recordSettingsEvent(await getStorage(), message.eventType)
        sendResponse({ ok: true })
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
  targetTabId?: number,
) {
  log('maybeTriggerChallenge started', { source, bypassCooldown })
  const storage = await getStorage()

  if (!bypassCooldown) {
    if (shouldBlockForUserSettings(storage)) {
      log('challenge blocked by user settings', {
        source,
        ...blockDetails(storage),
      })
      return false
    }
  }

  const vocabularyWords = getActiveWords(storage)
  const word = pickDueWord(vocabularyWords)
  if (!word) {
    log('challenge blocked: no due word', {
      source,
      wordCount: vocabularyWords.length,
    })
    return false
  }

  const [activeTab] = targetTabId
    ? []
    : await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = targetTabId ?? resolveDemoTabId(activeTab)
  log('tab resolved for challenge', {
    source,
    tabId,
    targeted: Boolean(targetTabId),
    activeTabId: activeTab?.id,
    readyContentTabs: readyContentTabs.size,
  })
  if (!tabId) {
    log('challenge blocked: no eligible content-script tab', { source })
    return false
  }

  const payload = buildChallengePayload(source, word, vocabularyWords)
  log('sending challenge to content script', { source, tabId, wordId: word.id })

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'bir-soz:show-challenge',
      payload,
    })
    log('challenge sent successfully', { source, tabId, wordId: word.id })
    return true
  } catch (error) {
    readyContentTabs.delete(tabId)
    log('challenge send failed', {
      source,
      tabId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

function resolveDemoTabId(activeTab: chrome.tabs.Tab | undefined) {
  if (activeTab?.id && readyContentTabs.has(activeTab.id)) {
    return activeTab.id
  }

  return readyContentTabs.values().next().value
}

async function ensureStatsFlushAlarm() {
  const existing = await chrome.alarms.get(STATS_FLUSH_ALARM_NAME)
  if (existing) return

  await chrome.alarms.create(STATS_FLUSH_ALARM_NAME, {
    periodInMinutes: STATS_FLUSH_PERIOD_MINUTES,
  })
  log('stats flush alarm created', {
    name: STATS_FLUSH_ALARM_NAME,
    periodInMinutes: STATS_FLUSH_PERIOD_MINUTES,
  })
}

async function handlePageActivity(senderTabId: number | undefined) {
  const storage = await getStorage()
  const nextCount = storage.navigationCount + 1
  await updateStorage({ navigationCount: nextCount })
  log('page activity noted', {
    senderTabId,
    nextCount,
    frequency: storage.settings.frequency,
    navigationTriggerEnabled: storage.settings.navigationTriggerEnabled,
  })

  if (!storage.settings.navigationTriggerEnabled) {
    log('page activity skipped: trigger disabled')
    return false
  }
  if (nextCount < storage.settings.frequency) {
    log('page activity skipped: frequency gate', {
      nextCount,
      frequency: storage.settings.frequency,
    })
    return false
  }

  if (shouldBlockForUserSettings(storage)) {
    await updateStorage({ navigationCount: 0, pendingTrigger: null })
    log(
      'page activity threshold reached but skipped: user settings blocked; reset counter without queuing',
      {
        senderTabId,
        previousCount: nextCount,
        nextCount: 0,
        ...blockDetails(storage),
      },
    )
    return false
  }

  await updateStorage({ navigationCount: 0 })
  const triggered = await maybeTriggerChallenge(
    'navigation',
    false,
    senderTabId,
  )
  log('page activity threshold reached: trigger attempt finished', {
    senderTabId,
    previousCount: nextCount,
    nextCount: 0,
    triggered,
  })
  return triggered
}

function blockDetails(storage: Awaited<ReturnType<typeof getStorage>>) {
  const now = Date.now()
  return {
    disabledUntil: storage.settings.disabledUntil,
    triggerOffRemainingMs: Math.max(
      0,
      (storage.settings.disabledUntil ?? 0) - now,
    ),
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
  await recordChallengeEvent(storage, result)
  await updateStorage(applyChallengeResult(storage, result))
  log('challenge result stored', { wordId: result.wordId })
}
