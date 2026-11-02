# Word labels (Pronunciation tab)

Clips have no transcripts, so the Pronunciation tab gets its words from Whisper `base.en` run once on the speaker's clip audio, in the browser.
Words are a **label layer**: the phone comparison never reads them, so a wrong word is a wrong label and never a wrong "difference".

- Feature: Heavy id `words` (`src/js/26-words.js`), off by default, own switch in Settings → Analysis with the size warning and "Delete downloaded data". Independent of the pronunciation model (`pronunciation`): phones only is the fallback.
- Worker: `src/words/worker.mjs` (transformers.js 3.3.3 + its ONNX Runtime Web build, WebAssembly only, `dtype: q8`, `return_timestamps: 'word'`). Model files are cached in the Cache API as `euno-words-model-v1`. Built to `/assets/h/words/<hash>/` with its own runtime files (about 23 MB WASM).
- Pure parts (tested in Node): `src/words/engine.mjs` turns Whisper chunks into clean `{ w, s, e }` spans (punctuation stripped, `[BLANK_AUDIO]`/`(music)` dropped, times clamped, a swallowed pause capped). If the model has no word alignment it falls back to phrase timings spread over each phrase and the clip is marked `wordsFor.timing: 'phrase'`.
- Stored on the clip: `clip.words = [{ w, s, e, x? }]` (seconds from the clip start, `x` = the learner fixed the spelling) and `clip.wordsFor = { start, end, model, timing, at }`. Both are cleared when the clip's start or end changes (`50-panel.js`).
- Reaches the engine through the contract's `external` field (`source: 'asr'`): `PronSource` attaches the words with `Phones.attachExternalWords` **after** the engine returns, because the engine's cached results must not freeze an older version of the words.
- Tab: "Get words (80 MB)" prompt → download + read in the background after the sounds are shown; "Fix words" lists every word as a text box (spelling only; times stay; empty removes the word). A model word with no matching recognised word shows its sounds.
- Tests: `npm run test:words`. Not covered by any test: the real model (needs Hugging Face).
