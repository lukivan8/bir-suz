# Task 11 verification

Before-task checkpoint: 23871a0. Organization section supports connect only,
name/code display, safe localized network/unknown/disabled errors. Operational
connect uses persisted installation UUID independently of analytics consent.
Connect and UUID creation are serialized. Same-code retry is idempotent, another
code is rejected after connection. Valid connection persists before catalog sync.
OrganizationSection exposes onConnected for task14; skip transition belongs to
onboarding. The opt-in v2 organization event is integrated in task16 with its queue.

Checks: npm test 18 passing, npm run lint no errors, npm run build successful.
Unit checks include safe error mapping, UUID reuse, consent-off operation,
idempotent retry, rejection of switching, and archived content preservation.

Browser evidence, native Chrome:
- Reloaded correct workspace build with Loaded from verified. Primary installation
  temporarily disabled while isolated local-API test copy was active.
- Local backend uses /tmp/bir-soz-managed-integration.sqlite, migration source empty.
  Unknown code shows not-found message; disabled synthetic code shows organization
  inactive message. Keyboard Enter submits form. Valid synthetic code connects,
  and four dictionaries appear without rebuilding/reinstalling.
- After extension Reload organization stays displayed; no code field, change,
  disconnect or participant controls remain. Analytics stays off.
- Synthetic stored gated SRS repetition7 created as controlled fixture; test
  organization archived using local HTTP PATCH only. Successful sync gives
  visible3/archived1/preservedSrs7/connected=true. No SRS/history deletion.
- Test copy disabled; main workspace re-enabled and latest build Reloaded.
  Popup retains 3-minute interval; normal answer and Demo Trigger skip work on
  HTTPS example.com. My Progress opens organization section and 3 dictionaries;
  reload preserves progress. Content and popup-page consoles empty. Dashboard/SW
  show ordinary lifecycle logs, no unhandled errors; extension Details has no Errors.

No production connect/archive writes. No storage dump or UUID/code logging.
