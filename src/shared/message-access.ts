import type { RuntimeMessage } from './messages'

/** Review boundary: Chrome supplies sender identity; never trust message fields. */
export function allowsBackgroundMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  extensionId: string,
): boolean {
  if (sender.id !== extensionId) return false
  const pageCommands = new Set([
    'bir-soz:content-ready',
    'bir-soz:page-activity',
    'bir-soz:submit-result',
  ])
  if (pageCommands.has(message.type)) {
    // No page URL is inspected or retained. Chrome isolates the content script.
    return Number.isInteger(sender.tab?.id) && sender.frameId === 0
  }
  // Only our two packaged UI entry points may request privileged operations.
  // This is an extension URL, never a visited webpage URL.
  const prefix = `chrome-extension://${extensionId}/`
  if (!sender.url?.startsWith(prefix)) return false
  const page = sender.url.slice(prefix.length).split(/[?#]/)[0]
  if (page !== 'index.html' && page !== 'dashboard.html') return false
  return message.type !== 'bir-soz:show-challenge'
}
