/* ---------- read just a stretch of audio from an MP4, without downloading the whole video ----------
   Finds the audio track's sample table in the file's index (moov box), fetches only the byte
   ranges that hold the audio for the requested time span, and decodes them with WebCodecs.
   Throws on anything it can't handle (not MP4, not AAC, no WebCodecs), so callers can fall back. */
const Mp4Audio = {
  tables: new Map(), // cache key -> parsed audio track (sample table etc.)

  /* a byte reader over a URL (HTTP Range) or a local File */
  reader(src) {
    if (src instanceof Blob) {
      return { size: async () => src.size, read: async (a, b) => new Uint8Array(await src.slice(a, b + 1).arrayBuffer()) };
    }
    let total = null;
    const read = async (a, b) => {
      const r = await fetch(src, { headers: { range: `bytes=${a}-${b}` }, credentials: 'same-origin' });
      if (r.status !== 206) throw new Error(r.ok ? 'no range support' : `HTTP ${r.status}`);
      const cr = r.headers.get('content-range');
      if (cr && total == null) total = +cr.split('/')[1];
      return new Uint8Array(await r.arrayBuffer());
    };
    return { read, size: async () => { if (total == null) await read(0, 15); return total; } };
  },

  async track(key, rd) {
    if (this.tables.has(key)) return this.tables.get(key);
    const total = await rd.size();
    // walk the top-level boxes until we reach moov (often at the end of downloaded videos)
    let off = 0, moov = null;
    while (off < total) {
      const hb = await rd.read(off, Math.min(total - 1, off + 15));
      const dv = new DataView(hb.buffer, hb.byteOffset, hb.byteLength);
      let size = dv.getUint32(0);
      const type = String.fromCharCode(hb[4], hb[5], hb[6], hb[7]);
      if (size === 1) size = Number(dv.getBigUint64(8));
      else if (size === 0) size = total - off;
      if (size < 8) throw new Error('bad box');
      if (type === 'moov') { moov = await rd.read(off, off + size - 1); break; }
      off += size;
    }
    if (!moov) throw new Error('no moov');
    const t = this.parseMoov(moov);
    this.tables.set(key, t);
    return t;
  },

  boxes(u8, start, end) {
    const out = [];
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = start;
    while (p + 8 <= end) {
      let size = dv.getUint32(p), hdr = 8;
      const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hdr = 16; } else if (size === 0) size = end - p;
      if (size < hdr) break;
      out.push({ type, start: p, body: p + hdr, end: Math.min(end, p + size) });
      p += size;
    }
    return out;
  },
  child(u8, box, type) { return this.boxes(u8, box.body, box.end).find((b) => b.type === type); },

  parseMoov(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const moov = this.boxes(u8, 0, u8.length)[0];
    for (const trak of this.boxes(u8, moov.body, moov.end).filter((b) => b.type === 'trak')) {
      const mdia = this.child(u8, trak, 'mdia');
      const hdlr = mdia && this.child(u8, mdia, 'hdlr');
      if (!hdlr || String.fromCharCode(...u8.subarray(hdlr.body + 8, hdlr.body + 12)) !== 'soun') continue;
      const mdhd = this.child(u8, mdia, 'mdhd');
      const timescale = u8[mdhd.body] === 1 ? dv.getUint32(mdhd.body + 20) : dv.getUint32(mdhd.body + 12);
      // edit list: media time where the track starts (skips encoder priming)
      let mediaStart = 0;
      const edts = this.child(u8, trak, 'edts');
      const elst = edts && this.child(u8, edts, 'elst');
      if (elst) {
        const v = u8[elst.body], n = dv.getUint32(elst.body + 4);
        for (let i = 0, p = elst.body + 8; i < n; i++) {
          const mt = v === 1 ? Number(dv.getBigInt64(p + 8)) : dv.getInt32(p + 4);
          p += v === 1 ? 20 : 12;
          if (mt >= 0) { mediaStart = mt; break; }
        }
      }
      const stbl = this.child(u8, this.child(u8, mdia, 'minf'), 'stbl');
      const cfg = this.audioConfig(u8, dv, this.child(u8, stbl, 'stsd'));
      // sample sizes
      const stsz = this.child(u8, stbl, 'stsz');
      const fixed = dv.getUint32(stsz.body + 4), count = dv.getUint32(stsz.body + 8);
      const sizes = new Uint32Array(count);
      for (let i = 0; i < count; i++) sizes[i] = fixed || dv.getUint32(stsz.body + 12 + i * 4);
      // chunk offsets
      const stco = this.child(u8, stbl, 'stco'), co64 = this.child(u8, stbl, 'co64');
      const cb = stco || co64, nChunks = dv.getUint32(cb.body + 4);
      const chunkOff = new Float64Array(nChunks);
      for (let i = 0; i < nChunks; i++) chunkOff[i] = co64 ? Number(dv.getBigUint64(cb.body + 8 + i * 8)) : dv.getUint32(cb.body + 8 + i * 4);
      // samples per chunk -> byte offset of every sample
      const stsc = this.child(u8, stbl, 'stsc'), nStsc = dv.getUint32(stsc.body + 4);
      const offsets = new Float64Array(count);
      let s = 0;
      for (let e = 0; e < nStsc; e++) {
        const first = dv.getUint32(stsc.body + 8 + e * 12) - 1, per = dv.getUint32(stsc.body + 12 + e * 12);
        const last = e + 1 < nStsc ? dv.getUint32(stsc.body + 8 + (e + 1) * 12) - 1 : nChunks;
        for (let c = first; c < last && s < count; c++) {
          let o = chunkOff[c];
          for (let k = 0; k < per && s < count; k++) { offsets[s] = o; o += sizes[s]; s++; }
        }
      }
      // decode times
      const stts = this.child(u8, stbl, 'stts'), nStts = dv.getUint32(stts.body + 4);
      const dts = new Float64Array(count);
      let t = 0; s = 0;
      for (let e = 0; e < nStts; e++) {
        const n = dv.getUint32(stts.body + 8 + e * 8), d = dv.getUint32(stts.body + 12 + e * 8);
        for (let k = 0; k < n && s < count; k++) { dts[s++] = t; t += d; }
      }
      return { timescale, mediaStart, sizes, offsets, dts, count, ...cfg };
    }
    throw new Error('no audio track');
  },

  audioConfig(u8, dv, stsd) {
    const entry = this.boxes(u8, stsd.body + 8, stsd.end)[0];
    if (!entry || (entry.type !== 'mp4a' && entry.type !== 'Opus')) throw new Error(`audio codec ${entry && entry.type} not supported`);
    const b = entry.body;
    const version = dv.getUint16(b + 8);
    const channels = dv.getUint16(b + 16);
    const rate = dv.getUint32(b + 24) >>> 16;
    const childStart = b + 28 + (version === 1 ? 16 : version === 2 ? 36 : 0);
    if (entry.type === 'Opus') return { codec: 'opus', channels, rate: 48000, asc: undefined };
    const esds = this.boxes(u8, childStart, entry.end).find((x) => x.type === 'esds');
    if (!esds) throw new Error('no esds');
    // walk the MPEG-4 descriptors down to DecoderSpecificInfo (the AudioSpecificConfig)
    let p = esds.body + 4;
    const desc = () => { const tag = u8[p++]; let len = 0, c; do { c = u8[p++]; len = (len << 7) | (c & 0x7f); } while (c & 0x80); return { tag, len }; };
    let d = desc();
    if (d.tag !== 3) throw new Error('bad esds');
    p += 2; const flags = u8[p++];
    if (flags & 0x80) p += 2;
    if (flags & 0x40) p += 1 + u8[p];
    if (flags & 0x20) p += 2;
    d = desc();
    if (d.tag !== 4) throw new Error('bad esds');
    const oti = u8[p];
    if (oti !== 0x40 && oti !== 0x66 && oti !== 0x67) throw new Error('not AAC');
    p += 13;
    d = desc();
    if (d.tag !== 5) throw new Error('no AudioSpecificConfig');
    const asc = u8.slice(p, p + d.len);
    let aot = asc[0] >> 3;
    if (aot === 31) aot = 32 + (((asc[0] & 7) << 3) | (asc[1] >> 5));
    return { codec: `mp4a.40.${aot}`, channels, rate, asc };
  },

  /* decode [t0, t1] seconds to mono 16 kHz */
  async extract(key, src, t0, t1, onProgress) {
    if (typeof AudioDecoder === 'undefined') throw new Error('no WebCodecs');
    const rd = this.reader(src);
    const T = await this.track(key, rd);
    const cfg = { codec: T.codec, sampleRate: T.rate, numberOfChannels: T.channels };
    if (T.asc) cfg.description = T.asc;
    const sup = await AudioDecoder.isConfigSupported(cfg);
    if (!sup.supported) throw new Error(`${T.codec} not decodable here`);
    const secOf = (i) => (T.dts[i] - T.mediaStart) / T.timescale;
    let i0 = 0, i1 = T.count - 1;
    while (i0 < T.count - 1 && secOf(i0 + 1) <= t0) i0++;
    i0 = Math.max(0, i0 - 2); // a little pre-roll for the decoder
    while (i1 > i0 && secOf(i1) > t1) i1--;
    // group samples into byte ranges (audio sits in chunks between video data)
    const ranges = [];
    for (let i = i0; i <= i1; i++) {
      const a = T.offsets[i], b = a + T.sizes[i] - 1;
      const last = ranges[ranges.length - 1];
      if (last && a - last.b <= 16384) { last.b = Math.max(last.b, b); last.i1 = i; } else ranges.push({ a, b, i0: i, i1: i });
    }
    const bufs = new Array(ranges.length);
    let done = 0, next = 0;
    const worker = async () => {
      while (next < ranges.length) {
        const k = next++;
        bufs[k] = await rd.read(ranges[k].a, ranges[k].b);
        done++;
        onProgress && onProgress(done / ranges.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, ranges.length) }, worker));
    // decode
    const startSec = secOf(i0);
    const outRate = T.rate;
    const total = Math.ceil((secOf(i1) - startSec + 0.2) * outRate);
    const mono = new Float32Array(total);
    let err = null;
    const dec = new AudioDecoder({
      output: (ad) => {
        const n = ad.numberOfFrames, ch = ad.numberOfChannels;
        const at = Math.round((ad.timestamp / 1e6 - startSec) * outRate);
        const tmp = new Float32Array(n);
        for (let c = 0; c < ch; c++) {
          ad.copyTo(tmp, { planeIndex: c, format: 'f32-planar' });
          for (let j = 0; j < n; j++) if (at + j >= 0 && at + j < total) mono[at + j] += tmp[j] / ch;
        }
        ad.close();
      },
      error: (e) => { err = e; },
    });
    dec.configure(cfg);
    ranges.forEach((r, k) => {
      for (let i = r.i0; i <= r.i1; i++) {
        const o = T.offsets[i] - r.a;
        dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(secOf(i) * 1e6), data: bufs[k].subarray(o, o + T.sizes[i]) }));
      }
    });
    await dec.flush();
    dec.close();
    if (err) throw err;
    // trim to the asked span and resample
    const a = Math.max(0, Math.round((t0 - startSec) * outRate));
    const b = Math.min(total, Math.round((t1 - startSec) * outRate));
    return { samples: DSP.resample(mono.subarray(a, b), outRate, SR), t0: startSec + a / outRate, t1: startSec + b / outRate };
  },
};
