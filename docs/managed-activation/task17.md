# Task 17 verification

Checkpoint 65b1ad2. New npm run test:http (also in npm test) launches separate
bir-stats process with a freshly created temporary SQLite, dynamically selected
loopback port, SQLITE_MIGRATE_PATH=''. All tested requests use actual fetch HTTP;
no app.request/server.fetch substitute. Process/DB cleaned in finally.

HTTP coverage: cold empty extension state; public stable IDs and schema rejection
when required level removed; ETag304/bodyless; organization conflict/idempotent
connect; dynamic fifth dictionary created from XLSX; replacement increments version
and preserves extension SRS7; invalid import leaves catalog unchanged; archive
hides gated while archived SRS7 remains. Raw120000/120001/3600000 received unchanged;
HTTP dashboard reports3 challenges and0.04h (150000ms server policy). Identical batch
accepted once, duplicates3 before and after real process restart. Public catalog
unchanged after restart. Dashboard does not expose synthetic installation UUID/DB path.

Extension34 tests PASS, lint/build PASS. Backend bun install --frozen-lockfile and
bun run check PASS:30 tests/typecheck. Existing backend tests cover migration and
backfill losslessness, time boundaries, legacy endpoints, all batch variants,
atomic failure/row limits, dashboard aggregates, privacy and dynamic catalog.
Existing extension tests cover migration/cache/SRS, sync races/304/failure, connect,
five confidence values, sequential onboarding/browser counter and consent/queue.

CI checks out sibling backend and runs both project checks plus extension tests.
Schemas/fixtures/validators equality tests run in extension; backend checks source
OpenAPI schema equality. No backend source changes or deploy required.
Independent read-only reviewer reran test:http and all34 tests, code PASS.

Native installed main Chrome: Loaded from workspace bir-suz/dist verified, Reloaded
observed, actual popup Demo answer and second skip on refreshed HTTPS example.com,
My Progress opens and retains data. Worker/content/dashboard/popup-page consoles
no unhandled errors; extension Details no Errors control. Main ON/test OFF,
separate test processes closed, analytics remains OFF. Full release journey is task18.
