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

## Usage Analytics in Version 0.2.1 and Later

Usage analytics are disabled by default. They can be turned on or off in the
dashboard settings under "Статистика использования". Local learning, SRS and onboarding
continue to work when analytics are off. No new learning events are created or
sent while analytics are off.

When enabled, version 0.2.1 and later send v2 learning events to `https://api.lukivan8.com`:

- a randomly generated installation identifier and stable event identifiers;
- event timestamps and organization ID when connected;
- onboarding start, step and completion; server dictionary selection;
- organization connection and card-session start/completion;
- server vocabulary/word IDs for card ratings and browser answers/skips;
- answer correctness, confidence rating and raw response duration.

The server calculates learning time from the original response duration. The
extension in version 0.2.1 and later does not upload word text, vocabulary names, per-word SRS histories,
custom vocabulary aggregates or new daily progress snapshots. Legacy local
statistics may remain on the device after an update but are not newly uploaded.
Events waiting for delivery remain in local storage through network failures and
browser restarts. Turning analytics off clears this queue and cancels an active
send attempt; it cannot undo requests already received by the server.

## Older Installations: Version 0.1.1

Older installations may continue using version 0.1.1 until updated. With analytics
opt-in, that version sends learning events to `/api/events` and daily learning
progress snapshots to `/api/snapshot` at `https://api.lukivan8.com`.
They include a random installation identifier, built-in vocabulary IDs and names,
built-in word IDs and text, answers/skips, correctness, response time, vocabulary
enable/disable actions, and built-in per-word spaced-repetition progress such as
repetition count, interval, next review time and mastery state. Snapshots also
include aggregate vocabulary progress, including custom vocabulary progress counts.
Custom vocabulary names, custom word text and IDs, and custom per-word progress
are not uploaded. These legacy requests require analytics consent; already received
records remain on the server after an update or opt-out. Version 0.2.1 and later
use the v2 events described above and do not send the legacy event/snapshot queues.

## Server Catalog and Organization Connection (Version 0.2.1 and Later)

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

## Restricted Organization Analytics

Organization names, codes and analytics are available only to authorized team accounts. The password-protected analytics dashboard shows
organization totals and a membership table with an organization-scoped pseudonym
and connection date. When learning analytics is enabled, the last completed
browser challenge date is also shown. These are pseudonymous, not anonymous,
records: someone who knows a participant's connection time may recognize them.
The raw installation UUID, email, individual event payloads and private words are
not displayed. A connection can appear even when learning analytics is disabled.
The extension explains organization data sharing before the user submits the optional code. Older extension versions may refer to public analytics; the dashboard is now restricted to trusted team accounts. All authorized accounts can access all organizations.

## Team Dashboard Accounts

Team login names and password hashes are stored on the server. Login creates a session lasting up to seven days, using an HttpOnly cookie. Logout invalidates the session; disabling an account or changing its password invalidates existing access. These team accounts are separate from extension installation identifiers.

## Data Sharing

Analytics data is sent only to the developer-operated API at
`https://api.lukivan8.com`. Bir Söz does not sell user data and does not share
user data with advertisers, data brokers, or advertising platforms.

Network delivery uses Cloudflare as infrastructure for the developer-operated API.
Network providers necessarily process IP addresses and connection metadata to
serve requests; the extension does not determine or submit geographic location.
Application request logs contain only method, route template, status and elapsed
time, not bodies, headers, IP addresses, installation IDs or organization codes.
Infrastructure processing is separate from optional learning-event collection.

## Data Retention and Deletion

Local learning progress, custom vocabulary, and settings remain on the user's
device in `chrome.storage.local`. The user can remove this local data by
uninstalling the extension or clearing extension data.

When usage analytics are enabled, analytics are associated with a random
installation identifier. They are not associated with a Google account, email
address, advertising identifier, or device hardware identifier.

Server analytics and organization connections currently have no automatic expiry
or self-service deletion. Uninstalling or disabling analytics does not erase
records already on the server. For privacy/deletion requests, use the developer
contact on https://www.birsoz.kz/; requests need to be assessed against the records
that can actually be identified. We do not promise an automated deletion process
or a fixed completion time that has not been implemented. Archived organizations
are hidden from the team dashboard; their stored connections/history remain.
Version 0.2.2 discards pending legacy and v2 queues when renewing consent. Older versions may retain dormant legacy queues. Turning analytics off clears the current v2 queue.
Do not downgrade to 0.1.1 to delete data: its old sender can resume legacy queues.

## Page Access and Local Custom Words

The extension attaches a learning overlay to ordinary webpages. It observes generic
page activity without extracting page URL, title, text, forms, cookies or history.
Custom words stay in local storage and are never sent to our API. If the user
practices custom words in the browser overlay, those displayed words are present
on that page; the open Shadow DOM is not a security boundary against the host page.

## Permissions

Bir Söz requests Chrome permissions to:

- store local settings and learning progress;
- detect generic tab/navigation activity so vocabulary prompts can appear during
  normal browsing;
- run scheduled catalog refreshes and consent-gated analytics retries;
- communicate with `https://api.lukivan8.com` for server dictionaries, an
  organization connection requested by the user, and consented usage analytics.

## Limited Use Statement

The use of information received from Google APIs will adhere to the Chrome Web
Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions, use the developer contact links (email or Telegram) in
the footer of https://www.birsoz.kz/.


Version 0.2.2: renewed analytics consent

Analytics now requires a decision for the current data-practice version, not
just the legacy analyticsEnabled setting. On upgrade, old permission is paused
and pending v2 and legacy analytics queues are discarded. No new learning
events are created until explicit consent. A one-time update tab explains the
choice; an unanswered choice stays visible in the extension without blocking
learning. Refusal and acceptance persist across ordinary subsequent updates.
Changing the decision is available in Settings. Local progress, vocabulary,
organization connection and installation identity are retained. Already received
server records are not deleted. Catalog downloads and optional organization
connection remain independent of learning-analytics consent.
