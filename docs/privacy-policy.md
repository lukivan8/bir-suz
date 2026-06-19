# Bir Söz Privacy Policy

Last updated: June 19, 2026

Bir Söz is a Chrome extension for learning Kazakh words while browsing. Its
mission is to help create a lightweight Kazakh-language environment during
everyday web use. This policy explains what data the extension handles and how
it is used.

## Data Stored Locally

Bir Söz stores the following data in `chrome.storage.local` on the user's
device:

- selected vocabulary and custom vocabulary entries;
- word learning progress, including repetition schedule and review history;
- challenge counts, correctness, response time, streaks, and settings;
- extension preferences such as cooldown, quiet mode, and analytics preference.

This local data is used to show vocabulary prompts, schedule reviews, and show
progress inside the extension.

## Usage Analytics

Usage analytics are disabled by default. On first install, Bir Söz shows a
disclosure screen with an opt-in action. Analytics can also be turned on or off
at any time in the dashboard settings under "Usage statistics".

When analytics are enabled, Bir Söz sends learning-related technical events to
`https://api.lukivan8.com`. The data may include:

- a randomly generated installation identifier;
- built-in vocabulary IDs, built-in vocabulary names, built-in word IDs, and
  built-in word text used by the learning feature;
- whether a challenge was answered, skipped, enabled, or disabled;
- whether an answer was correct;
- response time;
- spaced-repetition progress such as repetition count, interval, next review
  time, and mastery state;
- aggregate custom vocabulary progress counts, if the user creates custom
  vocabulary.

Analytics requests are limited to two types: learning events and daily
learning-progress snapshots. Learning events record actions such as answers,
skips, correctness, response time, and enable/disable events. Daily snapshots
record built-in word progress and aggregate vocabulary progress.

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
- communicate with `https://api.lukivan8.com` for usage analytics when usage
  statistics are enabled.

## Limited Use Statement

The use of information received from Google APIs will adhere to the Chrome Web
Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions, contact the developer through the support email listed on
the Chrome Web Store listing.
