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
