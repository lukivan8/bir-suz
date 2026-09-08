# Bir Söz Privacy Policy

Last updated: September 8, 2026

Bir Söz is a Chrome extension for learning Kazakh words while browsing. Its
mission is to help create a lightweight Kazakh-language environment during
everyday web use. This policy explains what data the extension handles and how
it is used.

## Data Stored Locally

Bir Söz stores the following data in `chrome.storage.local` on the user's
device:

- cached server catalogs, selected vocabularies and custom vocabulary entries;
- organization connection, onboarding checklist and an unfinished card session;
- a queue of consented learning events awaiting delivery;
- word learning progress, including repetition schedule and review history;
- challenge counts, correctness, response time, streaks, and settings;
- extension preferences such as cooldown, quiet mode, and analytics preference.

This local data is used to show vocabulary prompts, schedule reviews, and show
progress inside the extension.

## Usage Analytics

Usage analytics are disabled by default. They can be turned on or off in the
dashboard settings under "Usage statistics". Local learning, SRS and onboarding
continue to work when analytics are off. No new learning events are created or
sent while analytics are off.

When enabled, Bir Söz sends v2 learning events to `https://api.lukivan8.com`:

- a randomly generated installation identifier and stable event identifiers;
- event timestamps and organization ID when connected;
- onboarding start, step and completion; server dictionary selection;
- organization connection and card-session start/completion;
- server vocabulary/word IDs for card ratings and browser answers/skips;
- answer correctness, confidence rating and raw response duration.

The server calculates learning time from the original response duration. The
extension does not upload word text, vocabulary names, per-word SRS histories,
custom vocabulary aggregates or new daily progress snapshots. Legacy local
statistics may remain on the device after an update but are not newly uploaded.
Events waiting for delivery remain in local storage through network failures and
browser restarts. Turning analytics off clears this queue and cancels an active
send attempt; it cannot undo requests already received by the server.

## Server Catalog and Organization Connection

The extension downloads server dictionaries without requiring analytics consent.
After the first successful download it can use the last valid local cache offline.
To connect an organization, the user submits its code and the installation
identifier to the same API. This operational request is independent of learning
analytics consent. The code is stored locally and used to request the authorized
catalog, but is not included in analytics events. The interface offers connection
only; it does not provide account switching or member disconnection. Archiving
an organization on the server removes gated access on the next successful sync;
local learning history is retained.

Bir Söz does not send visited page URLs, page content, browsing history,
cookies, passwords, form inputs, screenshots, advertising identifiers, Google
account IDs, email addresses, or device hardware identifiers. The extension also
does not include clicked link URLs, link text, or selectors in analytics events.
Bir Söz does not send custom vocabulary names, custom word text, custom word
IDs, or custom per-word progress.

Analytics are used only to understand whether the learning prompts support
Kazakh vocabulary practice and to improve the learning experience.

## Data Sharing

Analytics data is sent only to the developer-operated API at
`https://api.lukivan8.com`. Bir Söz does not sell user data and does not share
user data with advertisers, data brokers, or advertising platforms.

## Data Retention and Deletion

Local learning progress, custom vocabulary, and settings remain on the user's
device in `chrome.storage.local`. The user can remove this local data by
uninstalling the extension or clearing extension data.

When usage analytics are enabled, analytics are associated with a random
installation identifier. They are not associated with a Google account, email
address, advertising identifier, or device hardware identifier.

## Permissions

Bir Söz requests Chrome permissions to:

- store local settings and learning progress;
- detect generic tab/navigation activity so vocabulary prompts can appear during
  normal browsing;
- run scheduled background maintenance for queued analytics;
- communicate with `https://api.lukivan8.com` for server dictionaries, an
  organization connection requested by the user, and consented usage analytics.

## Limited Use Statement

The use of information received from Google APIs will adhere to the Chrome Web
Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions, contact the developer through the support email listed on
the Chrome Web Store listing.
