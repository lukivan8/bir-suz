# Task 09 verification

Checkpoint before task: `3f2ad10`. Clean master; backend clean main `176b4b2`.

Implemented remote metadata, organization/catalog/onboarding storage fields, legacy
migration, pure validated remote merge and archive for unavailable remote content.
Removed bundled CSV and bootstrap loader. Custom dictionaries, settings and stats
remain local. Stable word identities retain SRS. Cold storage has no vocabulary.

Checks: npm ci; npm run build; npm test (Bun, 10 passing); npm run lint (no errors).
Existing warnings: five CSS specificity warnings and dynamic validator namespace
access. Contract fixtures/validators identical to backend; MV3 no-eval test passes.

Chrome native smoke, 2026-09-08:
- Verified workspace ID dmmhnmmaoefbdlbjfeanjeddnlcinnib and Loaded from
  /Users/lukivan8/dev/bir-soz-workspace/bir-suz/dist. Reloaded observed after build.
- Actual migrated storage summary: 3 remote dictionaries, 1 archived dictionary,
  onboarding v1, analytics false. No storage dump or identifiers collected.
- Real popup retained 3 minute interval and earlier statistics. Demo Trigger on
  HTTPS example.com displayed a challenge; answer and skip both worked.
- My Progress opened dashboard: three dictionaries, earlier SRS plus smoke result
  persisted across reload. Content console empty; extension consoles showed only
  ordinary lifecycle/analytics-disabled logs, no unhandled errors.
- Separate unpacked copy /private/tmp/bir-soz-managed-test, ID
  adlmgcifgdoiihocnfibeamhhncliehb, opened clean dashboard with 0 dictionaries and
  network-waiting text. Analytics declined. Task09 has no network client yet;
  actual network failure/recovery is covered in task10.
- Main copy was disabled only while clean copy was active. Test copy is now off,
  main workspace copy on. Old checkout installation stayed off; storage untouched.

Independent read-only review found empty-state UI validator rejection and missing
legacy fixture coverage. Both fixed and independently retested: code PASS,
10 tests pass. Browser evidence supplied after final smoke.
