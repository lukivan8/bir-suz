# Chrome Web Store Listing and Review Notes

Use this as source copy for the Chrome Web Store listing, privacy form, and
permission justifications. Keep the wording aligned with the in-product
analytics disclosure and the public privacy policy.

## Single Purpose

Bir Söz helps users learn Kazakh vocabulary by occasionally showing a small
translation challenge while they browse.

## Permission Justifications

`storage`: stores local vocabulary, learning progress, and settings.

`alarms`: periodically flushes queued usage analytics after the user enables
usage statistics.

Host permission for `https://api.lukivan8.com/*`: sends opt-in usage analytics
to the developer-operated API. Usage analytics are disabled by default,
disclosed on first install, and can be turned on or off from the extension
dashboard settings. The complete request schema is documented in
[`docs/analytics-schema.md`](analytics-schema.md), and the only analytics
network sender is `postJson()` in
[`src/shared/stats.ts`](../src/shared/stats.ts). A human-readable copy of the
analytics API contract is packaged in uploaded builds at
`review/analytics-api-contract.txt`.

Content script access to `http://*/*` and `https://*/*`: required to show the
learning prompt overlay on normal webpages. The content script sends only a
generic "page activity happened" signal after page loads and same-document
navigation events. It does not send page content, form inputs, cookies,
passwords, browsing history, visited page URLs, clicked link URLs, selectors, or
link text. The explicit content-script access contract and outbound message
builders are in
[`src/shared/content-script-access.ts`](../src/shared/content-script-access.ts).
The same human-readable review note is packaged in uploaded builds at
`review/content-script-access.txt`. The generated `web_accessible_resources`
entry keeps `use_dynamic_url` false because the CRXJS content-script loader
imports its bundled chunks from those URLs.

## Privacy Form Guidance

Do not select "does not collect user data." When usage statistics are enabled,
the extension collects learning-feature interaction data tied to a random
installation identifier.

Disclose these collection categories where available:

- extension usage analytics;
- user activity/product interaction, including answers, skips, correctness,
  response time, and learning progress;
- a pseudonymous/random installation identifier;
- aggregate custom vocabulary progress counts if the user creates custom
  vocabularies.

Do not disclose or imply collection of browsing history, website content, form
data, passwords, cookies, clicked links, screenshots, advertising identifiers,
email, Google account ID, or device hardware ID. The analytics payload also does
not include custom vocabulary names, custom word text, or custom word IDs.

Do not claim that the extension is local-only without qualification. A precise
claim is: learning content and progress are stored locally by default, and
optional usage analytics are sent only after the user enables usage statistics.

For the "How is this data used?" explanation, use:

Usage analytics are used only to understand whether the learning prompts support
Kazakh vocabulary practice and to improve the learning experience. Analytics
requests are limited to the two documented schemas in
`docs/analytics-schema.md`.

For the "Data sale/transfer" explanation, use:

Bir Söz does not sell user data and does not share user data with advertisers,
data brokers, or advertising platforms. Analytics are sent only to the
developer-operated API at `https://api.lukivan8.com`.

For the "Data retention/deletion" explanation, use:

Learning progress and custom vocabulary stored in `chrome.storage.local` can be
removed by uninstalling the extension or clearing extension data. Analytics sent
to the developer API are associated with a random installation identifier, not
with a Google account, email address, advertising identifier, or device hardware
identifier.

## Suggested Short Description

Learn Kazakh vocabulary through small translation prompts while browsing.

## Suggested Detailed Description

Bir Söz helps you practice Kazakh vocabulary during normal browsing. It
occasionally shows a compact translation challenge, tracks your local learning
progress, and lets you manage vocabularies from the dashboard.

Usage analytics are disabled by default. They are disclosed on first install and
can be turned on or off in the dashboard settings. Analytics are used to measure
learning-feature usage and do not include visited page URLs, page content,
clicked link URLs, selectors, link text, cookies, passwords, form inputs, or
browsing history.

## Suggested Permission Justification Copy

`storage`: Bir Söz stores vocabulary, learning progress, and settings locally on
the user's device.

`alarms`: Bir Söz uses a periodic alarm to flush queued usage analytics after
the user enables usage statistics.

`https://api.lukivan8.com/*`: Bir Söz sends opt-in usage analytics to the
developer-operated API. Analytics are disabled by default and do not include
visited page URLs, page content, form inputs, passwords, cookies, clicked links,
screenshots, browsing history, advertising identifiers, email, or Google account
ID.

Content script access to `http://*/*` and `https://*/*`: Bir Söz runs on normal
webpages to show the vocabulary prompt overlay during browsing and to detect
generic page/navigation activity. It does not read or send page URLs, page
content, form data, passwords, cookies, clicked links, CSS selectors,
screenshots, or browsing history.
