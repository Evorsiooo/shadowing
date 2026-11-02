/* Align two phone strings (speaker vs learner) and list the differences. Feature distances keep near-identical
   sounds from counting as errors. All thresholds are untuned. */

// consonants: [place 0..7, manner, voiced]. Places: bilabial, labiodental, dental, alveolar, postalveolar, palatal, velar, glottal
const C = {};
const cons = (syms, place, manner, voiced) => { for (const s of syms.split(' ')) C[s] = { place, manner, voiced }; };
cons('p', 0, 'stop', 0); cons('b', 0, 'stop', 1); cons('t', 3, 'stop', 0); cons('d', 3, 'stop', 1); cons('k', 6, 'stop', 0); cons('g ɡ', 6, 'stop', 1); cons('ʔ', 7, 'stop', 0);
cons('m', 0, 'nasal', 1); cons('n', 3, 'nasal', 1); cons('ŋ', 6, 'nasal', 1); cons('ɲ', 5, 'nasal', 1);
cons('f', 1, 'fric', 0); cons('v', 1, 'fric', 1); cons('θ', 2, 'fric', 0); cons('ð', 2, 'fric', 1); cons('s', 3, 'fric', 0); cons('z', 3, 'fric', 1);
cons('ʃ', 4, 'fric', 0); cons('ʒ', 4, 'fric', 1); cons('ç', 5, 'fric', 0); cons('x χ', 6, 'fric', 0); cons('h ɦ', 7, 'fric', 0);
cons('ɹ r ɻ ɽ', 4, 'approx', 1); cons('j', 5, 'approx', 1); cons('w ʍ', 0, 'approx', 1); cons('l ɫ ɭ', 3, 'lateral', 1); cons('ɾ', 3, 'tap', 1);
cons('c', 5, 'stop', 0); cons('ɟ', 5, 'stop', 1);
// vowels: [height 0 close..1 open, back 0..1, round 0/1]
const V = {};
const vow = (syms, h, b, r) => { for (const s of syms.split(' ')) V[s] = { h, b, r }; };
vow('i', 0, 0, 0); vow('ɪ', 0.2, 0.2, 0); vow('e', 0.33, 0, 0); vow('ɛ', 0.6, 0.1, 0); vow('æ', 0.85, 0.1, 0); vow('a', 1, 0.3, 0);
vow('ɨ ɘ', 0.2, 0.5, 0); vow('ə ɐ', 0.55, 0.5, 0); vow('ɜ', 0.6, 0.5, 0); vow('ʌ', 0.7, 0.9, 0); vow('ɑ', 1, 1, 0); vow('ɒ', 1, 1, 1);
vow('ɔ', 0.6, 1, 1); vow('o ɵ', 0.33, 0.9, 1); vow('ʊ', 0.2, 0.8, 1); vow('u ʉ', 0, 1, 1); vow('ɯ', 0, 1, 0); vow('y', 0, 0, 1); vow('ø œ', 0.4, 0.1, 1);
const SIB = new Set(['s', 'z', 'ʃ', 'ʒ']);
const REDUCED = new Set(['ə', 'ɪ', 'ʌ', 'ɐ', 'ɨ', 'ɘ', 'ʊ', 'ɚ']);

/** split "iː", "ɚ", "tʰ" into base symbol + flags. */
export function parse(sym) {
  let base = sym, long = false, rhotic = false, mods = '';
  for (const m of ['ː', '˞']) if (base.includes(m)) { if (m === 'ː') long = true; else rhotic = true; base = base.replace(m, ''); }
  const c = base[0];
  mods = base.slice(1); base = c;
  if (base === 'ə' && rhotic) { base = 'ɚ'; }
  return { base, long, rhotic, mods };
}
const vowelOf = (b) => V[b] || (b === 'ɚ' ? V['ə'] : null);

/** 0..1: how different two phone symbols are. */
export function distance(a, b) {
  if (a === b) return 0;
  const pa = parse(a), pb = parse(b);
  let d;
  if (pa.base === pb.base && pa.rhotic === pb.rhotic) return pa.long !== pb.long ? 0.12 : 0.04; // length / aspiration only
  const va = vowelOf(pa.base), vb = vowelOf(pb.base), ca = C[pa.base], cb = C[pb.base];
  if (va && vb) {
    d = 0.5 * Math.abs(va.h - vb.h) + 0.35 * Math.abs(va.b - vb.b) + 0.15 * Math.abs(va.r - vb.r);
    if (pa.rhotic !== pb.rhotic) d += 0.15;
    if (pa.long !== pb.long) d += 0.05;
    return Math.min(1, d);
  }
  if (ca && cb) {
    const place = Math.min(1, Math.abs(ca.place - cb.place) / 2), sib = SIB.has(pa.base) !== SIB.has(pb.base) && ca.manner === 'fric' && cb.manner === 'fric' ? 1 : 0;
    const manner = ca.manner === cb.manner ? 0 : (['stop', 'fric'].includes(ca.manner) && ['stop', 'fric'].includes(cb.manner)) || (ca.manner === 'tap' && cb.manner === 'stop') || (ca.manner === 'stop' && cb.manner === 'tap') ? 0.35 : 0.7;
    d = 0.45 * manner + 0.45 * place + 0.2 * sib + 0.25 * (ca.voiced === cb.voiced ? 0 : 1);
    if (['ɹ', 'r', 'ɻ', 'ɽ'].includes(pa.base) && ['ɹ', 'r', 'ɻ', 'ɽ'].includes(pb.base)) d = 0.05;
    return Math.min(1, d);
  }
  // glides vs close vowels
  if ((pa.base === 'j' && pb.base === 'i') || (pb.base === 'j' && pa.base === 'i') || (pa.base === 'w' && pb.base === 'u') || (pb.base === 'w' && pa.base === 'u')) return 0.3;
  return 1;
}

export const NEAR = 0.2, GAP = 0.8;

/** Needleman-Wunsch. a, b: arrays of {sym}. Returns ops. */
export function alignPhones(a, b) {
  const n = a.length, m = b.length, W = m + 1;
  const D = new Float32Array((n + 1) * W), B = new Uint8Array((n + 1) * W); // 1 diag, 2 up (del), 3 left (ins)
  for (let i = 1; i <= n; i++) { D[i * W] = i * GAP; B[i * W] = 2; }
  for (let j = 1; j <= m; j++) { D[j] = j * GAP; B[j] = 3; }
  const sub = (i, j) => distance(a[i].sym, b[j].sym);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const d = D[(i - 1) * W + j - 1] + sub(i - 1, j - 1), u = D[(i - 1) * W + j] + GAP, l = D[i * W + j - 1] + GAP;
    if (d <= u && d <= l) { D[i * W + j] = d; B[i * W + j] = 1; } else if (u <= l) { D[i * W + j] = u; B[i * W + j] = 2; } else { D[i * W + j] = l; B[i * W + j] = 3; }
  }
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const bk = B[i * W + j];
    if (bk === 1) { const c = sub(i - 1, j - 1); ops.push({ op: c === 0 ? 'match' : c < NEAR ? 'near' : 'sub', s: i - 1, l: j - 1, cost: c }); i--; j--; }
    else if (bk === 2) { ops.push({ op: 'del', s: i - 1, l: -1, cost: GAP }); i--; }
    else { ops.push({ op: 'ins', s: -1, l: j - 1, cost: GAP }); j--; }
  }
  return ops.reverse();
}

const side = (p, i) => (p ? { i, sym: p.sym, t0: p.t0, t1: p.t1, conf: p.conf } : null);
export const pairKey = (s, l) => `${s ?? '∅'}→${l ?? '∅'}`;
const lowerReduced = (sym) => REDUCED.has(parse(sym).base);

export const DIFF_LIMITS = { weakConf: 0.5, suggestConf: 0.65, maxSuggested: 3 };

export function compare(speaker, learner) {
  const sp = speaker.phones, lp = learner.phones;
  const ops = alignPhones(sp, lp);
  const diffs = [];
  let matched = 0, subs = 0, dels = 0, inss = 0;
  ops.forEach((o, k) => {
    if (o.op === 'match' || o.op === 'near') { matched++; return; }
    const s = o.s >= 0 ? sp[o.s] : null, l = o.l >= 0 ? lp[o.l] : null;
    const kind = o.op;
    if (kind === 'sub') subs++; else if (kind === 'del') dels++; else inss++;
    // anchor an insertion between the neighbouring speaker/learner phones
    let t0, t1, lt0, lt1;
    if (s) { t0 = s.t0; t1 = s.t1; } else { let pv = -1; for (let q = k - 1; q >= 0; q--) if (ops[q].s >= 0) { pv = ops[q].s; break; } t0 = t1 = pv >= 0 ? sp[pv].t1 : 0; }
    if (l) { lt0 = l.t0; lt1 = l.t1; } else { let pv = -1; for (let q = k - 1; q >= 0; q--) if (ops[q].l >= 0) { pv = ops[q].l; break; } lt0 = lt1 = pv >= 0 ? lp[pv].t1 : 0; }
    const confidence = Math.min(s ? s.conf : 1, l ? l.conf : 1);
    let weak = false, weakReason;
    if (kind === 'sub' && lowerReduced(s.sym) && lowerReduced(l.sym)) { weak = true; weakReason = 'vowel-reduction'; }
    else if (kind === 'sub' && o.cost < 0.3 && parse(s.sym).base === parse(l.sym).base) { weak = true; weakReason = 'length-only'; }
    else if (kind === 'sub' && o.cost < 0.3) { weak = true; weakReason = 'near-allophone'; }
    else if (confidence < DIFF_LIMITS.weakConf) { weak = true; weakReason = 'low-confidence'; }
    else if (kind !== 'sub' && ((s && lowerReduced(s.sym)) || (l && lowerReduced(l.sym)))) { weak = true; weakReason = 'vowel-reduction'; }
    const d = { id: `${kind}:${o.s >= 0 ? o.s : '-'}:${o.l >= 0 ? o.l : '-'}`, kind, pair: pairKey(s?.sym, l?.sym), speaker: side(s, o.s), learner: side(l, o.l), t0, t1, learnerT0: lt0, learnerT1: lt1, speakerWord: s ? s.word : null, learnerWord: l ? l.word : null, distance: kind === 'sub' ? o.cost : 1, confidence, weak };
    if (weakReason) d.weakReason = weakReason;
    diffs.push(d);
  });
  return { v: 1, ops, diffs, stats: { speakerPhones: sp.length, learnerPhones: lp.length, agreement: sp.length ? matched / sp.length : 0, subs, dels, inss } };
}

/** At most 3 ids: strong, confident diffs, one per speaker word, ranked by confidence x distance. Never padded. */
export function suggest(comparison) {
  const picked = [], words = new Set();
  const cands = comparison.diffs.filter((d) => !d.weak && d.confidence >= DIFF_LIMITS.suggestConf)
    .sort((a, b) => b.confidence * b.distance - a.confidence * a.distance);
  for (const d of cands) {
    const w = d.speakerWord ?? `l${d.learnerWord}`;
    if (words.has(w)) continue;
    words.add(w); picked.push(d.id);
    if (picked.length === DIFF_LIMITS.maxSuggested) break;
  }
  return picked;
}
