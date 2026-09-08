# Task 16 verification

Checkpoint 6a5e582. One v2 queue atomically committed with local learning state
under shared lock. Existing installation UUID reused; operational connect remains
independent of consent. No new legacy learning events/snapshots or parallel copies;
old legacy storage remains untouched, backend legacy endpoints unchanged.

Allowlisted transition events contain no code/name/page data/custom vocabulary IDs.
Raw duration only on card ratings and completed challenges; no client hours/cap.
Opt-out clears v2 queue and aborts current attempt. Sender uses fresh consent,
50-event batches, stable queued IDs, validated ACK totals, drops permanent partial
rejections, retains network failures and new events appended during requests.

33 tests PASS, lint/build PASS (existing six warnings, index-key style info only).
Independent read-only code review PASS, independently33 tests. Tests cover timing
120000/120001/9999999, forbidden payload fields, private dictionaries, offline IDs,
concurrent append/flush, partial rejects, poison filtering, opt-out abort/no-send.

Real local HTTP + headed isolated Chrome (/tmp/bir-soz-analytics-profile):
- Enabled consent in Settings; connected synthetic local organization ->catalog4.
- Stopped temporary-SQLite backend. Popup action/selection/organization step and
  card session continued from cache. First2 ratings via UI, remaining3 via actual
  extension runtime handlers. Controlled long shownAt yielded raw>120000 event.
- Queue14; full browser close/relaunch retained14 with identical ID SHA256 digest
  (only equality/count printed). No events in local DB before recovery.
- Restarted backend; ordinary persisted alarm delivered14. Explicit same-batch
  HTTP retry: status200 accepted0 duplicates14 rejected0.
- Real content overlay answer+skip through runtime force trigger in isolated
  browser produced2 more events. Added one synthetic unknown-organization event
  to test partial rejection: queue3 ->0, DB only2 valid added, total16.
- Local DB types: org1, onboarding_started1, step4, dictionary1, session start/end1
  each, cards5, challenge completed1/skipped1. Raw>120000 retained; session no duration.
- UI opt-out then restart checklist and one runtime card rating: queue0, SRS/result1.
  Isolated browser closed. No production writes; local backend uses temp SQLite.

Main native Chrome Loaded from workspace dist verified and Reloaded observed.
Actual popup above refreshed HTTPS example.com: Demo answer and second skip;
My Progress opens, dashboard consent=false queue0. Worker/content/dashboard and
popup-page consoles no unhandled errors; no Errors in extension Details. Main ON,
regular test copy OFF, separate test processes closed; storage preserved.
