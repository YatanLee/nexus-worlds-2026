# Release notes

## 2.2.0 · Model health and evidence freshness

- Added a readonly model-health overview grouped by model version and BO, with explicit denominators, coverage periods and exclusion reasons.
- Aggregate hit rates and probability errors remain hidden below 20 eligible matches per metric/group. Tied top scores and even winner probabilities have separate eligibility rules.
- Displayed rating calculation versus source observation times, recent official team results and lagged-rating warnings; manual player observations older than seven days require review.
- Confirmed October17 Taiwan-time results KC3–0MVK and FUR3–1C9 from the official source. Future fixture MVK–FUR is confirmed for October18 02:00 Taiwan time. Pregame history remains immutable.

The v2.1 main publication was verified after isolating a local-CLI test from inherited CI identity. First canonical run38990327599 published one eligible future baseline; earlier completed matches remain unrecorded.

## 2.1.0 · Auditable pregame history

- Added CI-only immutable baseline revisions, frozen rating/source provenance, deterministic model replay and latest eligible pregame selection per event/model.
- Added official-result assessments with team-ID mapping, identity-change exclusions and append-only result corrections. Missing pregame evidence is explicitly unrecorded, never backfilled.
- Added readonly prediction/evaluation APIs, fixed public-history download with ignored local cache, failure fallback and per-match comparison UI.
- Upgraded schedule rating provenance to schema3; legacy unknown observation times are not invented. Both fixture and rating freshness gate forecast generation.
- Restricted the daily writer to two public JSON artifacts, with a five-minute timeout and repeated ten-minute deadline checks against the original checkout commit.

Private notes/scenarios remain browser-local. The public ledger starts collecting only after this version's first eligible main CI run; earlier completed matches have no archived forecast.

## 2.0.0 · Official schedule and score predictions

- Replaced illustrative and custom fixtures with validated Riot Worlds 2026 data; unknown opponents remain TBD with official start time and BO.
- Removed odds inputs, pricing comparisons, and market selection flows.
- Added daily official-page crawler, loopback read-only API, last-good retention, per-fixture last-seen time, and daily GitHub workflow.
- Added official Elo exact-score distributions, series win probabilities, and optional manual scenario adjustment.
- Added Key Player role analysis, roster-source certainty, source dates, and player-specific mystic observations.
- Added three independent mystic score scenarios; these never alter model probabilities.
- Added real-match bookmarks, local notes and JSON export in a v2 storage namespace. Legacy custom/demo data is not imported into official matches.
- Added completed-result validation, complete-source replacement, partial-source provenance, and stale/started/TBD forecast suppression.

Validation: model/crawler/server tests, syntax checks, desktop/mobile browser interaction and visual QA, independent Security and Reviewer review. Final evidence is in the delivery report.

Known limits: SSR serialization and pagination may change. The initial page contains 40 matches and is explicitly incomplete. One automatic crawl attempt per daily window; failure retains data until tomorrow or a manual refresh. No live model, calibrated accuracy claim, or automatic starter verification. Player observations were checked on 2026-10-15 and disclose source certainty.

The service remains local. GitHub hosts source and public factual schedule summaries only.

## 1.0.0 · Superseded prototype

The initial visual prototype used illustrative data. Its fixture, pricing, and custom-match behavior has been replaced in v2.
