/* Data contract for in-browser pronunciation analysis (v1). Stable: additive changes only, announced in
   /mnt/project-files/euno/pronunciation-contract.md. All times are seconds. Everything here is plain JSON
   (structured-clone safe, storable in IndexedDB). English only. No transcript is needed or used. */

/** Seconds from the first sample handed to the engine. `originSec` on the sequence says what that is in the source. */
export type Sec = number;

/** One recognised phone. `sym` is IPA with modifiers merged in (iː, ɚ, tʰ). */
export interface Phone {
  sym: string;
  /** Peak-based CTC timing: span of the frames where the model emitted this phone. Accurate to about ±1 frame (`frameSec`, ~40 ms) at best; unvalidated. */
  t0: Sec;
  t1: Sec;
  /** Model posterior at the phone's strongest frame, 0..1. NOT calibrated: use for ranking and low-confidence flags only. */
  conf: number;
  /** Index into `PhoneSequence.words` (model word boundaries, not text). */
  word: number;
  /** Index into `PhoneSequence.external.words` when an external transcript is attached and overlaps in time; else absent. */
  extWord?: number;
}

/** A run of phones between model word-boundary marks (or long pauses). No text; see `external` for text. */
export interface PhoneWord {
  /** Index range into `phones`, `last` inclusive. */
  first: number;
  last: number;
  t0: Sec;
  t1: Sec;
}

/** Optional word spans from OUTSIDE the engine (ASR, captions) with timings. The engine never needs it and never creates it. */
export interface ExternalWords {
  source: 'asr' | 'captions' | 'none';
  words: { text: string; t0: Sec; t1: Sec }[];
}

export type QualityReason =
  | 'too-short' // under 0.4 s of audio
  | 'little-speech' // less than ~1 s of speech-level audio
  | 'low-confidence' // mean phone confidence under threshold: music, noise, or an overlapping voice
  | 'implausible-rate' // far too many or too few phones per second of speech
  | 'noisy' // many uncertain frames
  | 'clipping';

export interface ClipQuality {
  /** 'good' = usable. 'low' = show nothing from this clip unless the user asks. 'unusable' = no phones were kept. */
  level: 'good' | 'low' | 'unusable';
  reasons: QualityReason[];
  durationSec: Sec;
  speechSec: Sec;
  meanConf: number;
  phonesPerSpeechSec: number;
  /** Phones the model emitted on silence/noise-floor frames and the engine dropped instead of inventing. */
  droppedOnSilence: number;
}

export type ModelId = 'zipa-small-crctc-300k-int8' | 'xlsr-300m-phoneme-q8';

export interface PhoneSequence {
  v: 1;
  model: ModelId;
  phones: Phone[];
  words: PhoneWord[];
  /** Model output frame length (about 0.04). */
  frameSec: Sec;
  durationSec: Sec;
  /** What time 0 means in the source (e.g. the clip's start in video time); 0 when not given. */
  originSec: Sec;
  quality: ClipQuality;
  external?: ExternalWords;
  /** Milliseconds spent; for diagnostics only. */
  timingsMs?: { features: number; model: number; decode: number; total: number };
}

/** Sound-pair key "speaker→learner", e.g. "θ→s". Missing side is "∅": "∅→ə" (learner added), "θ→∅" (learner left out). */
export type SoundPair = string;

export interface DiffSide {
  /** Index into that side's `phones`. */
  i: number;
  sym: string;
  t0: Sec;
  t1: Sec;
  conf: number;
}

export type WeakReason = 'vowel-reduction' | 'length-only' | 'low-confidence' | 'near-allophone';

export interface PhoneDiff {
  /** Stable within one Comparison: `${kind}:${speaker.i ?? '-'}:${learner.i ?? '-'}`. */
  id: string;
  kind: 'sub' | 'del' | 'ins';
  pair: SoundPair;
  /** null for an insertion. */
  speaker: DiffSide | null;
  /** null for a deletion. */
  learner: DiffSide | null;
  /** Position on the SPEAKER's time axis (for an insertion: the gap where the learner added a sound; t0 === t1). */
  t0: Sec;
  t1: Sec;
  /** Same spot on the learner's time axis. */
  learnerT0: Sec;
  learnerT1: Sec;
  /** `PhoneSequence.words` indices; null if none. */
  speakerWord: number | null;
  learnerWord: number | null;
  /** 0..1, how different the two sounds are (feature distance; 1 for ins/del). */
  distance: number;
  /** 0..1 ranking score: minimum posterior of the phones involved. Not a probability of being right. */
  confidence: number;
  /** Likely model noise or normal variation: do not show by default. */
  weak: boolean;
  weakReason?: WeakReason;
}

export interface AlignOp {
  op: 'match' | 'near' | 'sub' | 'del' | 'ins';
  /** Speaker / learner phone index, or -1. */
  s: number;
  l: number;
  cost: number;
}

export interface Comparison {
  v: 1;
  ops: AlignOp[];
  diffs: PhoneDiff[];
  stats: {
    speakerPhones: number;
    learnerPhones: number;
    /** (match + near) / speakerPhones. A rough overlap figure, not a score. */
    agreement: number;
    subs: number;
    dels: number;
    inss: number;
  };
}

export type ResultStatus = 'ok' | 'speaker-low-quality' | 'learner-low-quality' | 'nothing-found';

export interface ClipResult {
  v: 1;
  /** Cache key: model id + both audio fingerprints. */
  key: string;
  createdAt: number;
  speaker: PhoneSequence;
  learner: PhoneSequence;
  comparison: Comparison;
  status: ResultStatus;
  /** Diff ids worth showing, best first, at most 3, empty unless status === 'ok'. Never padded. Thresholds are untuned. */
  suggested: string[];
}

export type EngineErrorCode =
  | 'unsupported' // no WebAssembly / Worker / Cache API
  | 'download-failed'
  | 'load-failed'
  | 'out-of-memory'
  | 'too-slow'
  | 'cancelled';

export interface ModelStatus {
  state: 'unsupported' | 'not-downloaded' | 'downloading' | 'downloaded' | 'loading' | 'ready' | 'error';
  /** 0..1 while downloading. */
  progress: number;
  bytes: number;
  error?: { code: EngineErrorCode; message: string };
  /** True once a run took longer than the real-time budget: UI should suggest turning the feature off. */
  slow: boolean;
  credit: string;
}

/** Main-thread API (src/js/24-phones.js, global `Phones`). Audio is mono 16 kHz Float32Array. */
export interface PhonesApi {
  supported(): { ok: boolean; reason?: string };
  status(): ModelStatus;
  onStatus(fn: (s: ModelStatus) => void): () => void;
  /** Opt-in download (~71 MB), cached. Idempotent. */
  download(): Promise<void>;
  remove(): Promise<void>;
  transcribe(samples: Float32Array, opts?: { originSec?: Sec; external?: ExternalWords }): Promise<PhoneSequence>;
  compare(speaker: PhoneSequence, learner: PhoneSequence): Promise<Comparison>;
  /** Cached per (model, speaker audio, learner audio). */
  analyse(speaker: Float32Array, learner: Float32Array, opts?: { speakerOriginSec?: Sec; external?: ExternalWords }): Promise<ClipResult>;
  /** Attach/replace external words (captions or ASR) on a stored sequence; recomputes `Phone.extWord`. */
  attachExternalWords(seq: PhoneSequence, ext: ExternalWords): PhoneSequence;
}
