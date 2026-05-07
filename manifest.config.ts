const manifest = {
  manifest_version: 3,
  name: 'Bir Söz',
  version: '0.1.0',
  description: 'Low-friction Kazakh micro-learning browser extension.',
  action: {
    default_popup: 'index.html',
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
  permissions: ['storage', 'tabs', 'idle'],
  host_permissions: ['http://*/*', 'https://*/*'],
  commands: {
    'demo-trigger': {
      suggested_key: {
        default: 'Ctrl+Shift+K',
        mac: 'Command+Shift+K',
      },
      description: 'Demo Trigger',
    },
  },
}

export default manifest
