Bir Soz / Bir Söz — reviewer starting point

Single purpose: Kazakh vocabulary practice through short translation challenges
while browsing, supported by vocabulary selection, flashcards and local progress.

Changes from published 0.1.1: dictionaries now load as JSON data from our API;
three stable-ID public dictionaries need no code/account; an optional organization
code unlocks extra content. Added resumable onboarding, resumable card practice,
server-ID-preserving SRS merge, and opt-in v2 learning events. No remote code.

Review navigation (paths relative to this ZIP):
- review/analytics-api-contract.txt: ALL three extension API endpoints, including
  non-analytics catalog and organization operations, consent and retries.
- review/api-schemas.json: exact request/response schema subset generated from
  the schemas used by runtime validators. $refs resolve in components.schemas.
- review/content-script-access.txt: page access, message and sender boundaries.
- review/remote-content.txt: validated JSON -> local cache -> text renderer.
- review/code-map.txt: generated executable file paths and search markers.
- review/third-party-licenses.txt: dependency copyright and license notices.
- review/test-instructions.txt: no-account walkthrough and optional code flow.

The code map is generated after bundling; the build fails if a marker disappears
or an endpoint is missing/stale in the API note. Code is intentionally unminified.
No special review-only behavior, remote switches or hidden test mode exists.
Privacy: https://api.lukivan8.com/privacy
Support: https://www.birsoz.kz/ (developer contact links in footer).
