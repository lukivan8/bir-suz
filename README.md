# Bir Söz

Bir Söz is a Manifest v3 Chrome extension for low-friction language retention. It injects a small, skippable vocabulary popup into normal browsing moments instead of asking the learner to open a separate study app.

Current MVP content is English → Russian multiple-choice vocabulary for fast iteration. The data model keeps source/target labels and room for future Kazakh Cyrillic/Latin variants.

## Current behavior

- Triggers can appear on:
  - every N-th new tab
  - idle return
  - every N-th link click
- If a new-tab page cannot be injected into, the challenge is deferred until the next eligible HTTP(S) page.
- The challenge popup is a small editorial paper card, not a blocking page.
- The popup is skippable with **Skip** or **Escape**.
- There is no countdown/progress bar.
- Answer speed and correctness feed SM-2-style SRS scheduling.
- Settings and progress are stored locally in `chrome.storage.local`.
- Dashboard is internal to the extension at `dashboard.html`.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run check:write
```

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select `dist/`.
6. Open any HTTP(S) page and use the extension popup **Demo Trigger** button or hotkey to test the overlay.

## Manual test checklist

After loading `dist/`:

- Open extension popup and change frequency/cooldown/theme settings.
- Use **Demo Trigger** on an HTTP(S) page.
- Confirm answer buttons submit and update stats.
- Confirm **Skip** and **Escape** dismiss the popup.
- Confirm cooldown prevents repeated normal triggers.
- Open `dashboard.html` and confirm streak, graph, vocabulary metrics, and mastered list render.

## Key files

- `manifest.config.ts` — extension manifest config
- `src/background.ts` — trigger orchestration and storage updates
- `src/content.tsx` — injected challenge overlay
- `src/content.css` — challenge overlay editorial design
- `src/App.tsx` — extension action popup/settings
- `src/dashboard.tsx` — dashboard logic
- `src/index.css` — dashboard editorial design
- `src/shared/learning-content.ts` — static MVP vocabulary
- `src/shared/challenge.ts` — challenge/SRS helper logic
- `src/shared/srs.ts` — SM-2-style scheduling
- `SPECIFICATION.md` — product specification
- `IMPLEMENTATION_CHECKLIST.md` — implementation plan
- `POPUP_DESIGN.md` — popup design notes
