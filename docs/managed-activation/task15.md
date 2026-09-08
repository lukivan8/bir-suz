# Task 15 verification

Checkpoint 0635035. Durable issued-challenge identity includes vocabulary/word,
source, tab and onboarding run/time. Result consumes once under storage lock;
wrong counts, skip/demo/unissued/pre-step/prior-run do not. SRS targets original
vocabulary including archive after selection/access change. Dispatch serialized,
failed sends/closed tabs remove pending records. No new cadence or timeout.

28 tests PASS; lint/build PASS (existing six warnings; five informational literal
key suggestions, two new required by TS index-signature property access).
Independent code review found no material issues; reviewer independently reran28 tests.

Native local test with analytics OFF: completed five onboarding cards; ordinary
HTTPS navigation triggers produced first wrong answer ->1/3. Demo correct and
Demo skip left1/3. Reload extension between answers preserved1/3 and cooldown3min.
After real cooldown elapsed, another natural answer ->2/3; next natural answer ->3/3.
Popup showed completion CTA. Pinned test icon screenshot showed check badge, actual
popup CTA opened completed dashboard and screenshot confirmed badge removed.

Literal full browser close tested separately: headed Chrome for Testing through
agent-browser, persistent /tmp/bir-soz-restart-profile, same local extension build.
Controlled synthetic intermediate1/3 state (not main storage) prepared, browser
closed, process relaunched with same profile: answers1/catalog3/consentfalse/cooldown3.
Browser closed again. Native full natural-answer flow above was tested separately.

Main Loaded from workspace dist verified, Reloaded observed, main ON/test OFF,
test pin restored off. Real popup Demo answer and second skip, My Progress,
worker/content/dashboard/popup-page consoles no unhandled errors, Details no Errors.
Scoped margin fix prevents old hint overlapping organization; screenshot verified.
