# Bir Söz Implementation Checklist

This checklist is the working implementation plan for aligning the project with `SPECIFICATION.md`, adjusted by current product direction notes.

## Product direction notes

- For now, generated **English → Russian** content is acceptable, even though the long-term goal is Kazakh retention.
- The challenge should be a **small, centered, skippable popup**, not a full-page blocker.
- It should be enough to refocus the user without breaking browser workflow.
- The previous hard 5-second timeout is a mistake.
- Do not show a countdown and do not enforce a time limit.
- After completion, show small timing feedback/notification so users can optionally try to answer faster next time.
- The timer must not auto-submit, fail, dismiss, or restrict the user.

## Phase 1 — Correct popup behavior

- [x] Remove hard 5-second timeout from challenge overlay.
- [x] Remove auto-failure/auto-skip on timeout.
- [x] Add small elapsed-time feedback after completion as a notification/status message.
- [x] Keep the challenge explicitly skippable.
- [x] Make overlay visually small, centered, and non-page-like.
- [x] Ensure it does not obscure the whole browser viewport unnecessarily.
- [x] Ensure Escape still skips/dismisses.
- [x] Ensure answer buttons submit normally.
- [x] Clean up keyboard listeners and intervals on close.

## Phase 2 — Content expansion using English

- [x] Replace the current 4-word hardcoded list with a larger generated English-based learning set.
- [x] Use English → Russian multiple-choice translation.
- [x] Store content in a separate static data file instead of inline inside `storage.ts`.
- [x] Add at least 100 entries.
- [x] Ensure each entry has exactly one correct answer and at least three distractors.
- [x] Ensure challenge option generation always includes the correct answer.
- [x] Update types if needed to avoid hardcoding `kk`/`ru` semantics.

## Phase 3 — Reliable trigger behavior

- [x] Fix new-tab trigger so it uses the same small popup approach on top of pages where extension injection is allowed.
- [x] Do not add a custom extension new-tab page for MVP.
- [x] If `chrome://newtab` cannot be injected into, defer the popup until the next eligible HTTP(S) page.
- [x] Keep default interruption level low.
- [x] Preserve cooldown logic.
- [x] Preserve skip behavior.

## Phase 4 — Navigation trigger

- [x] Add navigation trigger support.
- [x] Implement link-click counting first, preferably via content-script click tracking if Manifest V3 allows the needed flow cleanly.
- [x] Defer page-load and SPA-route counting until later.
- [x] Add required manifest permissions only if needed.
- [x] Add navigation frequency counter.
- [x] Add navigation trigger setting.
- [x] Add `navigation` or equivalent value to `TriggerSource`.
- [x] Respect cooldown, quiet hours, and disabled-until settings.

## Phase 5 — User-facing settings

- [x] Add UI to change challenge frequency.
- [x] Add UI to enable/disable idle trigger.
- [x] Add UI to enable/disable navigation trigger.
- [x] Add UI to configure quiet hours.
- [x] Add UI to change cooldown duration.
- [x] Add UI to pause/disable for a chosen duration.
- [x] Ensure all settings persist in `chrome.storage.local`.

## Phase 6 — SRS correctness

- [x] Replace simplified boolean SRS with closer SM-2-style logic.
- [x] Map challenge result to SM-2 quality score using correctness, skips, and answer speed.
- [x] Use answer speed as part of quality score.
- [x] Keep skip and wrong answers as failed reviews.
- [x] Add tests or documented examples for interval progression.
- [x] Ensure due-word selection does not always pick the first due word.

## Phase 7 — Dashboard completion

- [x] Track daily review history.
- [x] Implement current streak calculation.
- [x] Implement best streak calculation.
- [x] Show visual streak on dashboard.
- [x] Add 7-day progress graph.
- [x] Add mastered words list.
- [x] Define mastered-word threshold.
- [x] Show active vocabulary metrics.
- [x] Keep dashboard internal to extension.

## Phase 8 — Theme support

- [ ] Make `overlayTheme` setting actually affect UI.
- [ ] Support light mode.
- [ ] Support dark mode.
- [ ] Support system mode.
- [ ] Apply theme to popup challenge.
- [ ] Apply theme to popup/settings if appropriate.

## Phase 9 — Script/language flexibility

Original spec mentions Kazakh Cyrillic/Latin toggle. Current temporary content direction allows English-generated content, but the data model should not block future Kazakh support.

- [ ] Avoid hardcoding field names like `kk` and `ru` in generic learning logic.
- [ ] Add a content model that can support source/target labels.
- [ ] Leave room for future Cyrillic/Latin Kazakh variants.
- [ ] Add script toggle only when Kazakh content is restored.

## Phase 10 — Polish and validation

- [ ] Run `npm run build` after each completed block.
- [ ] Run `npm run lint` or `npm run check:write` before committing where practical.
- [ ] Manually test extension load from `dist/`.
- [ ] Manually test skip, answer, popup close, and storage update.
- [ ] Manually test trigger cooldown behavior.
- [ ] Update README with current behavior and install/test instructions.
