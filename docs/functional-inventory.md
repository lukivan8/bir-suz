# Functional inventory

Inventory date: 2026-09-08. Extension version: 0.1.1.

Status legend: **working** means the path is implemented and covered by a successful build; **partial** means the path exists with a known functional gap; **missing** means the data model anticipates it but the product does not provide it.

## User surfaces

| Area | Status | Current behavior |
| --- | --- | --- |
| Popup summary | Working | Shows completed challenge count and success rate. |
| Popup cooldown | Working | Configures 0–15 minutes between automatic challenges; default is 3 minutes. |
| Temporary do-not-disturb | Working | Pauses challenges for 30 minutes, 1, 2, 4, or 8 hours and shows a countdown. |
| Vocabulary picker | Working | Selects one vocabulary. If several are active through the dashboard, the popup reports that state and selecting one collapses the selection to that vocabulary. |
| Demo Trigger button | Working in code; runtime recheck needed | Requests a challenge on an eligible HTTP(S) tab and explains when no content-script tab is ready. |
| Keyboard Demo Trigger | Working in code; runtime recheck needed | `Command+Shift+K` on macOS and `Ctrl+Shift+K` elsewhere invoke the same forced trigger. The automated Chrome side-panel test did not surface the overlay. |
| Progress dashboard | Working | Opens in a new extension tab and shows streak, total correct answers, a 13-week heatmap, vocabularies, words, and mastery state. |
| First-run analytics choice | Working | Opens the dashboard on install and asks the user to opt in. Analytics defaults to off. |

## Challenge flow

| Capability | Status | Current behavior |
| --- | --- | --- |
| New-tab trigger | Working | Counts created tabs and queues a challenge on every fifth tab by default. |
| In-page navigation trigger | Working | Watches initial load, History API changes, `popstate`, hash changes, and Navigation API entry changes. Triggers every fifth activity by default. |
| Eligible pages | Working | Runs on ordinary HTTP(S) pages. Chrome internal pages and other restricted pages are excluded by the platform. |
| Translation direction | Working | Chooses Kazakh → Russian two thirds of the time and Russian → Kazakh one third of the time. |
| Answer choices | Working | Shows the correct answer plus up to three unique distractors from all active vocabularies. |
| Result feedback | Working | Marks correct/wrong choices, displays response time, and closes after 1.2/1.7 seconds. |
| Skip | Working | Button and `Escape` submit a skipped result and close immediately. |
| Long text | Working | Shrinks the word from 52 px to 32 px and then wraps when needed. The overlay is isolated in an open Shadow DOM. |
| Timeout | Missing | `timedOut` exists in the contract but no timer ever sets it to `true`. |

## Learning and content

| Capability | Status | Current behavior |
| --- | --- | --- |
| Built-in content | Working | Four CSV vocabularies with 50 entries each (200 total): basic, everyday, expanded, and verbs. Levels A1, A2, and B1 are supported. |
| Multiple active vocabularies | Working | Dashboard switches can enable several vocabularies; challenges draw from their combined words. At least one vocabulary is always kept active. |
| SM-2 update | Working | Correctness, skip/timeout, and response speed map to quality 0–5; repetition, interval, ease, and next review are updated. |
| Due-date enforcement | Partial | Due words are preferred, but when none are due the picker deliberately falls back to any active word. The next-review date therefore does not suppress early repetition. |
| Mastery | Working | A word is mastered at repetition ≥ 3 and interval > 7 days. Dashboard filters all/mastered/in progress/new. |
| Streaks | Working | Stores 90 days of daily activity and calculates current and best consecutive-day streaks. |
| Script variants | Missing | Latin/Cyrillic variant types exist but challenge generation and editing do not use them. |

## Vocabulary management

| Capability | Status | Current behavior |
| --- | --- | --- |
| Create/rename/delete vocabulary | Working | Custom vocabularies can be managed in the dashboard. The last vocabulary cannot be deleted; deletion requires typing its name. |
| Add/edit/delete words | Working | Requires Kazakh and Russian text, prevents duplicate Kazakh source text case-insensitively, and confirms deletion. |
| CSV import | Partial | Accepts `.csv`, comma or semicolon separators, and skips incomplete/duplicate rows. It is not an RFC 4180 parser, so quoted separators are not handled correctly. |
| Built-in updates | Working | Storage migration refreshes bundled vocabularies while retaining custom vocabularies and learning state where word IDs match. |

## Settings and storage

| Capability | Status | Current behavior |
| --- | --- | --- |
| Local persistence | Working | Vocabulary, settings, progress, trigger counters, and analytics queues use `chrome.storage.local`. |
| Backward migration | Working | Normalizes legacy storage and seeds missing/current built-in vocabulary content. |
| Quiet-hours schedule | Missing | `quietHours` has `enabled`, `startHour`, and `endHour`, but `isQuietTime()` always returns `false`. The popup currently offers temporary do-not-disturb instead. |
| Frequency UI | Missing | `frequency` exists (default 5) but cannot be changed in popup or dashboard. |
| Trigger switches UI | Missing | `newTabTriggerEnabled` and `navigationTriggerEnabled` exist (both default on) but have no controls. |
| UI language | Partial | The model has `uiLanguage`, but only Russian is accepted and rendered. |

## Analytics and server integration

| Capability | Status | Current behavior |
| --- | --- | --- |
| Consent | Working | No events or snapshots are recorded while analytics is disabled. Enable/disable events are sent only while enabled. |
| Data minimization | Working | Sends a random installation UUID, built-in vocabulary/word IDs and text, learning events, response time, and progress. It does not send page URL/content, cookies, credentials, browsing history, or custom vocabulary content/IDs. |
| Offline queue | Working | Keeps up to 1,000 events and 14 daily snapshots, sends events in batches of 50, retries every minute, and retains failed items. |
| API | Working | Uses `https://api.lukivan8.com/api/events` and `/api/snapshot`; the Perry service is reached through Cloudflare Tunnel. |
| Server dashboard | Working/protected | Production dashboard and its mutation endpoints require HTTP Basic Auth. API request logging excludes bodies, headers, query strings, UUIDs, emails, IPs, and full URLs. |

## Verification record

- `npm run lint`: passed with five existing CSS specificity warnings.
- `npm run build`: passed with Vite 8.2.2.
- GitHub Actions: passed for commit `f60f227`.
- `https://api.lukivan8.com/api`: returned HTTP 200 through Cloudflare Tunnel.
- Perry `bir-stats.service`: active; production checkout clean at its GitHub `main` commit.
- Chrome ordinary-page smoke test: `https://example.com` loaded. The automation shortcut did not expose a challenge overlay, so popup/Demo Trigger interaction remains a manual runtime recheck.

## Recommended next work

1. Decide whether SRS should suppress challenges when no words are due; if yes, remove the fallback in `pickDueWord` and define the empty-state behavior.
2. Implement cross-midnight quiet hours and expose their controls, or remove the unused scheduled setting in favor of temporary do-not-disturb.
3. Expose frequency and per-trigger switches in the dashboard.
4. Add unit tests for SRS, streaks, storage migration, active-vocabulary behavior, and CSV parsing; add an extension E2E harness for popup and content overlay.
5. Replace the ad hoc CSV parser if quoted fields are a supported import format.
