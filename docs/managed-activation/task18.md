# Task 18 release verification

Checkpoint: 5c22749. Release changes are README/privacy-policy updates to match
remote-only catalogs, persistent onboarding/cards, connect-only organization and
opt-in v2 events. No extension runtime change or backend source change in task18.

Final automated checks: extension34 tests PASS including a real HTTP subprocess
on temporary SQLite, backend30 tests+typecheck PASS, lint/build PASS. Lint retains
six existing warnings (CSS5, validator namespace1) and10 index-key style infos.
Dependency installs: npm ci earlier, Bun frozen-lockfile repeated for release.
Node22.22.3, Bun1.3.13. Production manifest permits only api.lukivan8.com for API;
no localhost, bundled dictionaries or production dictionary content dependency.

## Clean native browser journey

Headed isolated Chrome for Testing152, fresh profile /tmp/bir-soz-release-profile,
copy /tmp/bir-soz-release-test with build-time API origin127.0.0.1:4018.
Observed ID giikfcjjpmedfcakmbhjaklaeeagibjp; native Details Loaded from
/private/tmp/bir-soz-release-test verified. The production copy remained enabled
in the user's separate regular Chrome profile; no same-page duplicate copies.

- Clean installation auto-opened dashboard while local backend was unavailable:
  catalog0, waiting/retry, Start five cards disabled, first checklist step pending.
- Started backend with temporary SQLite and SQLITE_MIGRATE_PATH=''. Catalog3
  appeared. Actual popup on example.com ->My Progress completed return step.
- UI selected A1+A2 then confirmed; connected synthetic local organization with
  analytics OFF. Catalog4 including verbs; no switch/disconnect/member controls.
- Rated first2 cards through native UI. Stopped local backend and fully closed
  only isolated Chrome process. Relaunch retained organization/catalog4/SRS2 and
  checklist step4. Continue resumed card3; remaining3 native flip/rate actions
  completed session5 from offline cache and opened browser step. Cooldown3min
  and frequency5 remained unchanged; interval recommendation visible.
- Actual-popup Demo answer and Demo skip on HTTPS kept onboarding0/3 and queue0.
  Initial rapid navigation moved away during an overlay; it was not counted as an
  answer or accepted as evidence. Subsequent natural flow used settled pages.

## Server update without rebuild

Restarted local backend. Uploaded controlled verbs-valid.xlsx to verbs/import:
version1->2,50->2words. Created an additional server dictionary from that XLSX.
Actual installed runtime sync yielded catalog5, version changed, A1 SRS identical.
No rebuild/reinstall of test copy between upload and observation.

## Analytics and backend display

Ordinary release UI smoke stayed analytics OFF, no learning events created.
Separate opt-in/offline/restart/dedup/partial rejection checks are documented in
task16.md; final release re-opened its local backend dashboard at127.0.0.1:4017.
Russian summary and organization view showed connected installations, onboarding,
completed challenge1 and server-created learning time0.03hours. No email,
installation UUID or database path in displayed page text. No production writes.

## Main installed production build

Final npm run build -> workspace bir-suz/dist. Native regular Chrome Details:
ID dmmhnmmaoefbdlbjfeanjeddnlcinnib, Loaded from
~/dev/bir-soz-workspace/bir-suz/dist. Clicked extension Reload; Reloaded observed.
Reopened actual popup above refreshed HTTPS example.com; Demo answer and skip
both worked. My Progress opened/refreshed; local consent=false, queue0.
Worker, content, dashboard and popup-page consoles had no unhandled errors.
Main storage preserved. Old checkout/copy not changed or enabled.

## External release status

Read-only public API /api, /api/v1/vocabularies and dashboard returned200.
Read-only ssh perry systemctl is-active bir-stats returned active. Backend remains
176b4b2; no deploy or tunnel changes required. Git fetch found extension ahead11,
behind0 before task18 commit; backend aligned0/0. Safe push follows the reviewed checkpoint commit.

## Non-blocking limitations

- Six existing lint warnings and ten style infos; no errors.
- Browser coverage: current Chrome and isolated Chrome for Testing, not all browsers.
- Chrome Web Store publication not performed; requires separate request.

Additional controlled local analytics check during the normal cooldown: Settings
opt-in -> manual session start+one UI rating produced queue2. Settings
opt-out -> another UI card rating persisted result2 while queue0; browser count
remained2. Consent was restored OFF before continuing natural challenges.

Local organization archive: an initial malformed diagnostic PATCH was rejected400
with no state change; corrected contract field active=false returned200. Next
installed runtime sync changed catalog5->3 and archive0->2. Gated SRS serialized
identically before/after, organization connection retained, no gated items or
member-management controls in UI. No production organization modified.

## Completed natural sequence and return

Three settled HTTPS navigation-triggered overlays answered with unchanged
frequency5/cooldown3min. Storage observations0->1->2->3; second intentionally
wrong (corridor -> ice cream) still counted. Third correct (mirror) completed
browser step. At3: consentfalse, queue0, returnedfalse and chrome.action badge✓.
Actual pinned extension popup on HTTPS displayed3/3 and completion return CTA.
Clicking CTA opened completed dashboard: returnedtrue and badgeempty. The first
five-card session and all three natural answers ran with analytics OFF; the
separate consent experiment during cooldown is described above.

After overlays, original example.com heading/paragraph/link remained intact and
no question overlay remained. Test worker/content consoles and dashboard page
errors empty. Final main extension Details had no Errors; main ON, old checkout
OFF, regular managed-test copy OFF. Closed only isolated release Chrome process;
stopped both temporary local backend processes4017/4018. Profiles/storage retained
outside repositories. User Chrome windows and production backend left running.

Independent read-only review: PASS after correcting the privacy-policy field
claims. Reviewer inspected final diff, release command logs and the complete
browser evidence against every acceptance criterion. No open mandatory findings.
