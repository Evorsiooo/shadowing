# Pronunciation differences in the app

Sound-level differences from the speaker (English only, beta, off by default: Settings → Pronunciation).
The engine is the global `Phones` (contract: `src/phones/contract.d.ts`). `src/js/24-pron.js` adapts its `ClipResult`
(substitutions only, `weak` ones dropped, the engine's `suggested` first) to one small object per recorded pass,
saved on the recording as `phones`: `{ v, diffs: [{ a, b, words, speaker, you, from, to, conf }], sounds }`.
Until the engine is in the build, `PronMock` supplies demo data, only with `?pronmock=1` or `localStorage.euno_pronmock = '1'`.

Where it shows: review card after a recorded pass (max 3, Speaker/You snippets, Drill this, "Sounds the same to me"),
the start of a note ("From this take"), step 3 vs final, one line in the end-of-session popup (only for a difference in both
recordings), Progress → Issues ("Seen across sessions"), the step 4 "Today's focus" line, and the AI prompt.

Device-side state is one `meta` document, `pron`, written once per recorded pass: per-pair tallies (flagged count, days,
clips), how often each speaker sound occurred, dismissed pairs, and which automatic notes exist. A pair becomes an
automatic note ("possible, listen and confirm", `notes` with `auto: true`) when it was flagged on 2+ different days and in
at least half of the places that sound occurred (3+ places). Thresholds are guesses until the native-ear check.
Dismissing a pair deletes its tally and blocks it. Automatic notes never call the AI; Ask AI on one is a user tap with their own key.
The AI gets `Phones …: speaker "θ r iː", learner "s r iː"` lines plus a caveat that the recogniser is about 90% right.

## History, "gone quiet" and the AI/MCP view
- Each tracked pair keeps daily buckets `{d, f, o}` (flagged, chances = how often the speaker's sound occurred) for 120 days, plus 8 example words/dates and `first`/`last`. Chances are added on every recorded pass for every tracked pair, flagged or not, so a pause in practice or clips without the sound never count as "stopped". Size: a few KB.
- State per pair (`e.state`): `active`; `easing` (flagged share in the last 14 days at most half of the 14 before, 6+ chances in each); `archived` (10+ chances since the last flag, 14+ days, at most 1 flag in 30 days). Archived returns to active on 2 flagged days within 14 days, or 30%+ of the last 10 chances. Thresholds are guesses (`PRON_QUIET`) until the native-ear check.
- Trend = last 14 days against the 14 before, only with 6+ chances in both; wide bands (±20 points).
- Setting `pronAutoArchive` (default on): an unconfirmed automatic note gets `archived: true` and moves to "Gone quiet" in Progress → Issues; "Still happening to me" reopens it. Confirmed notes are never archived by software: their issue row shows "Mark as fixed?". Dismissed pairs stay blocked.
- Timing/pitch/stress: `meta/prosody` keeps the same buckets per kind (rushed, dragged, pitch, stress), recorded from the comparison the review card already computes. Works in every language.
- AI: up to two `History:` lines per note for the sound pairs in the take, one for the most frequent timing/pitch/stress difference. MCP: `get_pronunciation_progress` and a `pronunciation` summary in `get_overview`, on by default.
