# Chrome Web Store review notes

Current package review entry point: [review/README.txt](../public/review/README.txt).
Release preparation evidence is local to workspace `project-tasks/chrome-web-store-release`.

Single purpose: Kazakh vocabulary practice during normal browsing, supported by
local progress, optional organizations, onboarding and flashcards.

## Required permissions

- storage: local preferences, SRS, custom words, downloaded catalog, organization,
  onboarding/card session and consented event queue.
- alarms: catalog refresh every15 minutes and opt-in event retry every minute.
- https://api.lukivan8.com/*: public server content, explicitly requested
  organization connection, and separately opt-in learning analytics.
- HTTP(S) content-script matches: automatic page overlays and generic activity
  triggers need persistent access. activeTab only after a click cannot implement
  existing automatic practice. No tabs/history/cookies permission is added.
- Generated WAR enables CRXJS local chunk loading, use_dynamic_url:false.

## Privacy form

Disclose persistent installation identifiers as personally identifiable information
under CWS identification-number guidance, and User activity for learning interactions.
These identifiers are pseudonymous, not fully anonymous. Custom vocabulary text is
locally stored and can appear in the overlay, never in API payloads. No page content,
URLs, browsing history, credentials, health or financial data is extracted.
Catalog/connection traffic is independent of analytics consent; never claim all
network requests require opt-in. Organization-scoped pseudonyms/connect dates and,
with analytics, last completed task dates are publicly displayed. Read the complete
[privacy policy](privacy-policy.md), including infrastructure and retention caveats.

Remote code: No, subject to final ZIP audit. Remote dictionary JSON is validated
and rendered as text; all executing JS/CSS is bundled. No remote SDK/eval/WASM.

Do not reuse old two-endpoint justifications or promise safe downgrade to0.1.1.
Review documentation must refer to actual generated chunks, not only source files.
