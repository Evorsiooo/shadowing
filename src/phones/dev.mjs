/* Developer page logic: load two audio files, run Phones.analyse, show phones, differences and timings. */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
$('credit').textContent = Phones.CREDIT;

function renderStatus(s) {
  $('barfill').style.width = `${Math.round(s.progress * 100)}%`;
  $('status').textContent = `${s.state}${s.state === 'downloading' ? ` ${(s.bytes / 1048576).toFixed(1)} MB` : ''}${s.slow ? ' (slow on this device)' : ''}${s.error ? ` - ${s.error.code}: ${s.error.message}` : ''}`;
}
Phones.onStatus(renderStatus); renderStatus(Phones.status());
Phones.ready.then(() => renderStatus(Phones.status()));
$('dl').onclick = () => Phones.download().catch(() => {});
$('rm').onclick = () => Phones.remove();

async function decode(file) {
  const buf = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 16000, 16000);
  const ab = await ctx.decodeAudioData(buf);
  const off = new OfflineAudioContext(1, Math.ceil(ab.duration * 16000), 16000);
  const src = off.createBufferSource(); src.buffer = ab; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0).slice();
}

const phoneRow = (seq) => `<div class="ipa">${seq.words.map((w) => seq.phones.slice(w.first, w.last + 1).map((p) => `<span class="${p.conf < 0.6 ? 'lo' : ''}" title="${p.t0.toFixed(2)}s conf ${p.conf.toFixed(2)}">${esc(p.sym)}</span>`).join('')).join('<span style="margin:0 8px">·</span>')}</div>`;
const timing = (name, s) => `<tr><td>${name}</td><td>${s.durationSec.toFixed(1)} s</td><td>${s.timingsMs.features}</td><td>${s.timingsMs.model}</td><td>${s.timingsMs.decode}</td><td>${s.timingsMs.total}</td><td>${(s.timingsMs.total / 1000 / s.durationSec).toFixed(2)}x</td><td>${s.phones.length}</td><td>${s.quality.level}${s.quality.reasons.length ? ` (${s.quality.reasons.join(', ')})` : ''}, mean conf ${s.quality.meanConf.toFixed(2)}, ${s.quality.droppedOnSilence} dropped on silence</td></tr>`;

$('go').onclick = async () => {
  const fs = $('fs').files[0], fl = $('fl').files[0];
  if (!fs || !fl) { $('run').textContent = 'Pick both files.'; return; }
  try {
    $('run').textContent = 'Decoding audio...';
    const [a, b] = await Promise.all([decode(fs), decode(fl)]);
    $('run').textContent = 'Running (first run also loads the model)...';
    const t = performance.now();
    const r = await Phones.analyse(a, b);
    $('run').textContent = `Done in ${((performance.now() - t) / 1000).toFixed(1)} s (cached results return instantly).`;
    const diffs = r.comparison.diffs.map((d) => `<tr class="${d.weak ? 'weak' : ''}"><td class="ipa">${esc(d.pair)}</td><td>${d.kind}</td><td>${d.t0.toFixed(2)}s</td><td>${d.confidence.toFixed(2)}</td><td>${d.weak ? 'weak: ' + d.weakReason : r.suggested.includes(d.id) ? '<b>suggested</b>' : ''}</td></tr>`).join('');
    $('out').innerHTML = `<h2>Result: ${r.status}</h2>
      <p>Speaker</p>${phoneRow(r.speaker)}<p>You</p>${phoneRow(r.learner)}
      <p class="muted">Phone agreement ${(r.comparison.stats.agreement * 100).toFixed(0)}% (${r.comparison.stats.subs} substitutions, ${r.comparison.stats.dels} left out, ${r.comparison.stats.inss} added). Faded phones have confidence under 0.6.</p>
      <h2>Differences</h2><table><tr><th>Speaker→You</th><th>Kind</th><th>At</th><th>Conf</th><th></th></tr>${diffs || '<tr><td colspan="5">None</td></tr>'}</table>
      <h2>Timings (ms) on this device</h2><table><tr><th></th><th>Audio</th><th>Features</th><th>Model</th><th>Decode</th><th>Total</th><th>Total / audio</th><th>Phones</th><th>Quality</th></tr>${timing('Speaker', r.speaker)}${timing('You', r.learner)}</table>
      <h2>JSON</h2><pre>${esc(JSON.stringify(r, null, 1))}</pre>`;
  } catch (e) {
    $('run').innerHTML = `<span class="err">${esc(e.code || 'error')}: ${esc(e.message)}</span>`;
  }
};
