# Third-party notices

## ZIPA phone recogniser (pronunciation feature)
- Model: ZIPA-small CR-CTC (`anyspeech/zipa-small-crctc-300k` on Hugging Face), ONNX int8 export. Not bundled: each user's browser downloads it from Hugging Face on opt-in and keeps it on the device.
- Authors: Jian Zhu and colleagues, "ZIPA: A family of efficient speech models for multilingual phone recognition", ACL 2025. Code: https://github.com/lingjzhu/zipa (MIT, Copyright (c) 2025 jzhu).
- Licence: the repository README says most ZIPA weights are CC BY 4.0, except the `ns` models (trained on CC BY-NC-SA data), which must not be used commercially. The checkpoint used here is not an `ns` model. Attribution (also shown with the feature): "Pronunciation model: ZIPA (Jian Zhu et al., ACL 2025), CC BY 4.0."
- `src/phones/tokens.mjs` is the repository's `ipa_simplified/tokens.txt` (MIT). The feature extraction in `src/phones/fbank.mjs` is a port of the settings used by the reference script (lhotse Fbank, Apache-2.0 reference).

## ONNX Runtime Web
- `onnxruntime-web` 1.20.1, MIT, Copyright (c) Microsoft Corporation. Its loader and WebAssembly files are served from this site (`/assets/h/phones/`).

## Whisper word labels (Pronunciation tab, optional)
- Model: Whisper `base.en` (OpenAI, MIT) as the ONNX conversion `Xenova/whisper-base.en` on Hugging Face, 8-bit files. Not bundled: each user's browser downloads it on opt-in (Settings → Analysis, "Word labels", about 80 MB) and keeps it on the device. The MIT licence of the weights is from memory and still to be checked against the model card.
- Runtime: `@huggingface/transformers` 3.3.3 (Apache-2.0, Copyright Hugging Face) and the ONNX Runtime Web build it ships (MIT, Copyright (c) Microsoft Corporation). The worker and the runtime files are served from this site (`/assets/h/words/`). Attribution shown with the feature: "Word labels: Whisper (OpenAI, MIT) as ONNX files by Xenova, run on your device with transformers.js (Apache-2.0)."
