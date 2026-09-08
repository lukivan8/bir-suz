# Task 12 verification

Checkpoint e604aab. Pure study core and lock-serialized runtime handlers select
five unique vocabulary/word pairs from active available dictionaries, snapshot
text, persist index/results/SRS and reject stale session/index ratings. New words
first, due next; intentional manual study may also practice other active words.
Browser picker strictly due-only. Completed sessions are not resumed.

Cards require shown then flipped state before rating; raw duration persists.
All five confidence values map 0/2/3/4/5. No new local hours are calculated; old
stored hours remain. Remote updates cannot alter current card snapshot, existing
SRS is read fresh when rated. Archived vocabulary SRS is updated when applicable.

Checks: 23 tests pass; lint no errors, build passes. Independent code review PASS.

Real installed Chrome test (temporary local API copy, analytics off): runtime
messages exercised core before task13 UI exists. Started five unique cards,
rated two, repeated prior request: size5/index2/results2. Reloaded extension and
reopened dashboard; start resumed index2, rated remaining three: index5/results5,
completed true. No unhandled errors. No main-user session data modified.

Main workspace Loaded from verified and Reloaded. Test copy disabled, main enabled.
Real popup on HTTPS example.com: Demo Trigger answered, second Demo skipped;
overlay closes, content console empty. My Progress retains 3 dictionaries and SRS,
including smoke changes, after reload. Popup-page console empty; dashboard/worker
ordinary lifecycle logs, no unhandled errors; no Errors in extension Details.
