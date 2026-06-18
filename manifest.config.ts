import { defineManifest } from '@crxjs/vite-plugin'

const manifest = {
  manifest_version: 3,
  name: 'Bir Söz',
  version: '0.1.0',
  description: 'Qazaq sózderin úırenýge arnalǵan braýzer keńeıtimi.',
  icons: {
    16: 'favicon-16x16.png',
    32: 'favicon-32x32.png',
    192: 'android-chrome-192x192.png',
    512: 'android-chrome-512x512.png',
  },
  action: {
    default_popup: 'index.html',
    default_icon: {
      16: 'favicon-16x16.png',
      32: 'favicon-32x32.png',
    },
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content.tsx'],
      run_at: 'document_idle',
    },
  ],
  options_page: 'dashboard.html',
  permissions: ['storage', 'alarms'],
  host_permissions: ['https://api.lukivan8.com/*'],
  commands: {
    'demo-trigger': {
      suggested_key: {
        default: 'Ctrl+Shift+K',
        mac: 'Command+Shift+K',
      },
      description: 'Mysal tapsyrmany kórsetý',
    },
  },
} satisfies chrome.runtime.ManifestV3

export default defineManifest(manifest)
