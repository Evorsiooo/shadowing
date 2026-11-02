# In-browser pronunciation engine

Compares the learner's recording with the shadowed speaker's audio, phone by phone, on the user's device. English only. No transcript is used, nothing is hosted by Euno, nothing is uploaded.

- Types and rules: `src/phones/contract.d.ts` (copy: project file `euno/pronunciation-contract.md`).
- Code: `src/phones/` (`fbank` features, `ctc` decoding, `align` comparison, `quality` checks, `engine` glue, `worker` for the browser), client `src/js/24-phones.js` (global `Phones`). Not wired into the UI yet.
- Model: ZIPA-small int8 (~71 MB) downloaded on opt-in from Hugging Face, kept in the Cache API (`euno-phones-model-v1`), run in a module Web Worker with onnxruntime-web (WASM, one thread, because the app is not cross-origin isolated). Licence and attribution: `THIRD-PARTY-NOTICES.md`.
- Results are cached per (model, speaker audio, learner audio) in the IndexedDB `euno-phones`, not in the app Store (which syncs to the server).
- Developer page: `/app/phones-dev/` (signed in). Command line: `node scripts/phones-bench.mjs --model model.int8.onnx speaker.wav [learner.wav]`.
- Tests: `npm run test:phones`.
- Known gaps: not run with the real model yet in the build environment; quality and "suggested" thresholds are placeholders to tune with the dev page; WebGPU is not used; word text comes from a separate step (`external` words).
