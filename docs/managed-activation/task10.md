# Task 10 verification

Before-task checkpoint: 969512e. Runtime catalog client uses protocol validation,
ETag/304, bounded network timeout and credentials omit. Startup/install/update and
15-minute alarm sync, explicit cold-state retry, live UI refresh. Concurrent sync
is coalesced. Access changes during HTTP force a new request. Migration and all
vocabulary mutations use the same cross-context Web Lock; merge rereads storage.

Checks: npm test, 16 passing; npm run lint, no errors (same six warnings plus TS
index-signature style suggestions); npm run build. Backend dependencies installed
with frozen lockfile, no source/database changes in backend checkout.

Chrome actual smoke:
- Main workspace Loaded from and ID reverified; Reloaded observed. Production
  catalog sync updated: three remote dictionaries, 150 words, ETag and timestamp.
  Analytics false. Alarm-triggered repeat logged unchanged (304).
- Local API build only at /tmp/bir-soz-managed-test; temporary SQLite only,
  SQLITE_MIGRATE_PATH empty, backend port4017. Main disabled during test copy use.
- Backend stopped: cold dashboard shows 0 dictionaries and retry. Backend started:
  retry loads three 50-word dictionaries without reloading UI. Synthetic local
  organization access installed in test storage: sync shows four dictionaries.
- Backend stopped again: sync returns failure with cache count4/version4. Extension
  Reload and reopening dashboard retain four dictionaries while server unavailable.
- Test copy switched off, main switched on. Real popup retains three-minute
  interval. Demo Trigger over HTTPS: answer then skip, overlay closes. My Progress
  displays 3 dictionaries and retained SRS (6 words in progress after smoke), reload
  persists. Content console empty, extension console has no unhandled errors.
  Expected failed-network status in isolated downtime test is distinct from errors.

Review: initial finding unlocked migration race corrected. Added delayed lock test
and real mutation-during-fetch SRS/custom content assertions. No production writes.
