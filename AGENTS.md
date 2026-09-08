# Bir Söz agent guide

## Goal

Maintain the Manifest V3 Chrome extension that teaches Kazakh vocabulary during normal browsing.

## Architecture

- `src/background.ts` coordinates extension lifecycle, alarms, messages, and analytics delivery.
- `src/content.tsx` and `src/content.css` render the learning challenge on web pages.
- `src/App.tsx` is the popup; `src/dashboard.tsx` is settings and local progress.
- `src/shared/` contains storage, SRS, validation, messaging, vocabulary, and analytics contracts.
- `manifest.config.ts` is the source of truth for permissions and extension metadata.

## Commands

```bash
npm install
npm run lint
npm run build
```

Before browser work, read [local testing](docs/local-testing.md). After each extension change: lint/build → Reload the correct unpacked extension → reopen popup and refresh test tabs → verify the exact change plus popup/dashboard and answer/skip flow. A successful build alone is not completion. Check Loaded from: the old ~/dev/bir-suz/dist installation is a different checkout. Preserve user storage and keep test analytics off.

## Change rules

- Keep permissions minimal. Explain any new permission in the README and store notes.
- Preserve analytics opt-in. Never collect page URLs, page content, cookies, credentials, custom vocabulary text, or custom vocabulary IDs.
- Keep changes to analytics payloads synchronized with `openapi.yaml`, `src/shared/stats.ts`, and the `bir-stats` service.
- Treat `chrome.storage.local` migrations as backward-compatible production migrations.
- Run lint and build before committing. Add focused tests when behavior changes.
