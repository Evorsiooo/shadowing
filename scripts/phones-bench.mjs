// Runs the pronunciation engine in Node (ONNX Runtime Web, WASM) on local WAV files, so the model can be timed and
// checked without a browser:  node scripts/phones-bench.mjs --model path/to/model.int8.onnx speaker.wav [learner.wav]
// With one file it prints the phones and timings; with two it also prints the differences.
// WAV only (16-bit PCM or 32-bit float, any rate). Convert other files first: ffmpeg -i in.mp4 -ac 1 -ar 16000 out.wav
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { transcribe, analyseSequences } from '../src/phones/engine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mi = args.indexOf('--model');
if (mi < 0 || !args[mi + 1]) { console.error('usage: node scripts/phones-bench.mjs --model model.int8.onnx speaker.wav [learner.wav]'); process.exit(1); }
const modelPath = args[mi + 1];
const files = args.filter((a, i) => i !== mi && i !== mi + 1);

function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`${path}: not a WAV file`);
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(o + 8), ch: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') { data = b.subarray(o + 8, Math.min(b.length, o + 8 + size)); break; }
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${path}: no audio found`);
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch)), mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) { const p = (i * fmt.ch + c) * bps; s += fmt.bits === 16 ? data.readInt16LE(p) / 32768 : fmt.bits === 32 && fmt.tag === 3 ? data.readFloatLE(p) : NaN; }
    mono[i] = s / fmt.ch;
  }
  if (Number.isNaN(mono[0])) throw new Error(`${path}: unsupported WAV format (use 16-bit PCM or 32-bit float)`);
  if (fmt.rate === 16000) return mono;
  const ratio = fmt.rate / 16000, out = new Float32Array(Math.floor(n / ratio));
  for (let i = 0; i < out.length; i++) { const x = i * ratio, i0 = Math.floor(x), f = x - i0; out[i] = mono[i0] * (1 - f) + (mono[Math.min(n - 1, i0 + 1)] || 0) * f; }
  return out;
}

const ort = await import(pathToFileURL(join(root, 'node_modules/onnxruntime-web/dist/ort.wasm.min.mjs')).href);
ort.env.wasm.wasmPaths = pathToFileURL(join(root, 'node_modules/onnxruntime-web/dist') + '/').href;
ort.env.wasm.numThreads = 1;
let t = performance.now();
const session = await ort.InferenceSession.create(new Uint8Array(readFileSync(modelPath)), { executionProviders: ['wasm'] });
console.log(`model loaded in ${Math.round(performance.now() - t)} ms; inputs ${session.inputNames}, outputs ${session.outputNames}`);

async function runModel(feats, frames) {
  const out = await session.run({ x: new ort.Tensor('float32', feats, [1, frames, 80]), x_lens: new ort.Tensor('int64', BigInt64Array.from([BigInt(frames)]), [1]) });
  const o = out[Object.keys(out)[0]];
  return { logProbs: o.data, T: o.dims[1], V: o.dims[2] };
}
const show = (name, s) => {
  console.log(`\n${name}: ${s.durationSec.toFixed(1)} s audio, ${s.phones.length} phones, quality ${s.quality.level} ${s.quality.reasons.join(',')}, mean conf ${s.quality.meanConf.toFixed(2)}`);
  console.log(`  ms: features ${s.timingsMs.features}, model ${s.timingsMs.model}, decode ${s.timingsMs.decode}, total ${s.timingsMs.total} (${(s.timingsMs.total / 1000 / s.durationSec).toFixed(2)}x audio length)`);
  console.log('  ' + s.words.map((w) => s.phones.slice(w.first, w.last + 1).map((p) => p.sym).join(' ')).join('  |  '));
};
const seqs = [];
for (const f of files) { const s = await transcribe(readWav(f), { runModel }); seqs.push(s); show(f, s); }
if (seqs.length === 2) {
  const r = analyseSequences(seqs[0], seqs[1]);
  console.log(`\nstatus ${r.status}, agreement ${(r.comparison.stats.agreement * 100).toFixed(0)}%`);
  for (const d of r.comparison.diffs) console.log(`  ${d.pair}\t${d.kind}\t@${d.t0.toFixed(2)}s\tconf ${d.confidence.toFixed(2)}${d.weak ? '\tweak: ' + d.weakReason : ''}${r.suggested.includes(d.id) ? '\tSUGGESTED' : ''}`);
}
