# Bir Söz Specification

## Primary demo hotkey name
- **Demo Trigger**
- Manifest command id: `demo-trigger`
- Suggested shortcut: `Ctrl+Shift+K` / `Command+Shift+K`

## MVP goal
A Manifest v3 Chrome extension that surfaces a 5-second Kazakh micro-challenge during low-friction browser moments.

## Product principles
- Zero-decision entry
- Non-blocking UX
- Local-first privacy
- Measurable retention

## Stack
- SolidJS
- TypeScript
- Tailwind CSS
- Vite
- CRXJS Vite plugin

## Implemented scaffold
- `manifest.config.ts`: MV3 manifest, permissions, commands
- `src/background.ts`: trigger orchestration, cooldown, quiet-hours guard, result handling
- `src/content.tsx`: Shadow DOM overlay injection for site-safe UI isolation
- `src/App.tsx`: popup controls and demo trigger
- `src/dashboard.tsx`: dashboard metrics view
- `src/shared/srs.ts`: modified SM-2 utility
- `src/shared/storage.ts`: local-first storage schema and seed data
- `src/shared/types.ts`: strict TypeScript interfaces

## Trigger rules
- New tab trigger: every N-th tab
- Idle return trigger: on transition back to active
- Cooldown: default 5 minutes
- Quiet hours: configurable, currently scaffolded in settings
- Demo override: hotkey or popup button bypasses cooldown

## Storage keys
- `wordBank`
- `userStats`
- `settings`
- `newTabCount`

## Challenge UX
- 1 Kazakh word
- 4 Russian options
- 5-second timer
- `Esc / Skip`
- Shadow DOM container to avoid style collisions on external sites

## Why Shadow DOM first?
Build **Shadow DOM injection first**.
- It de-risks Tailwind/style leakage on arbitrary websites.
- It proves the hardest extension-specific UI path early.
- SM-2 can be iterated in isolation once the overlay is reliably renderable.

## Next steps
1. Expand curated word bank to 150 A1-A2 pairs.
2. Persist daily streak and mastery analytics.
3. Add quiet-hours editor in popup.
4. Add Chart.js or lightweight SVG charts to dashboard.
5. Add "disable for 1 hour" and settings feedback states.
