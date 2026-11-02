# Third-party notices

## ZIPA phone recogniser (pronunciation feature)
- Model: ZIPA-small CR-CTC (`anyspeech/zipa-small-crctc-300k` on Hugging Face), ONNX int8 export. Not bundled: each user's browser downloads it from Hugging Face on opt-in and keeps it on the device.
- Authors: Jian Zhu and colleagues, "ZIPA: A family of efficient speech models for multilingual phone recognition", ACL 2025. Code: https://github.com/lingjzhu/zipa (MIT, Copyright (c) 2025 jzhu).
- Licence: the repository README says most ZIPA weights are CC BY 4.0, except the `ns` models (trained on CC BY-NC-SA data), which must not be used commercially. The checkpoint used here is not an `ns` model. Attribution (also shown with the feature): "Pronunciation model: ZIPA (Jian Zhu et al., ACL 2025), CC BY 4.0."
- `src/phones/tokens.mjs` is the repository's `ipa_simplified/tokens.txt` (MIT). The feature extraction in `src/phones/fbank.mjs` is a port of the settings used by the reference script (lhotse Fbank, Apache-2.0 reference).

## ONNX Runtime Web
- `onnxruntime-web` 1.20.1, MIT, Copyright (c) Microsoft Corporation. Its loader and WebAssembly files are served from this site (`/assets/h/phones/`).
