# Euno's research notes

`src/knowledge/entries.json` holds 31 short entries about what research says on shadowing and accent learning (English first; French and Spanish topics included). They were written from papers opened one by one, then checked by a separate reader on 2026-11-05; every source carries how much of it was read (full text, abstract, excerpt, secondhand), and each entry says what it does not show. Some sources are still unverified and stay labelled in the entry. Evidence labels: direct (shadowing studies), adjacent (related research), thin (little or no good evidence).

How they are used (Ask Euno only):
- `scripts/build.mjs` ships the file inside the app script as `KNOWLEDGE`. Nothing is hosted or fetched.
- `src/js/86-knowledge.js` matches the learner's question to up to three entries on their device (keywords in English, French and Spanish).
- `askSend` (`src/js/87-ask.js`) sends those entries as plain text in the `knowledge` field of `POST /api/ai/chat`; `server/ai.js` puts them after the background lines with rules: cite only what the notes say, say the evidence label, say "no good evidence" when it is thin, mention abstract-only or secondhand sources.
- The reply shows a small line naming the evidence label.
- Nothing is added when no entry fits, so small talk and unrelated questions are unchanged.

Test: `npm run test:knowledge`. To change an entry, edit the JSON (keep the `read` level on every source and never add a source nobody opened).
