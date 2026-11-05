// Euno drawn once, as plain SVG, for places that can't run the engine: the favicon and icons, the public
// site's logo, and the server's own pages (sign-in consent, invites, errors).
import { renderAvatarFrame, createAvatarPlaybackState } from './engine/core/index.ts';
import full from './euno.avatar.json' with { type: 'json' };
import { calmDefinition } from './calm.mjs';

const r1 = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n) * 10) / 10));

/* fit: crop the view to Euno himself (with `pad` around him) instead of the engine's 300-unit square */
export function eunoSvg(expression = 'neutral', { size = null, label = 'Euno', fit = true, pad = 6, body = null, eyes = null, idSuffix = '', look = [0, 0] } = {}) {
  const definition = calmDefinition(full, { look });
  const playback = { ...createAvatarPlaybackState(), activeExpression: expression };
  const s = renderAvatarFrame(definition, playback, 0, { random: () => 0.5, reduceMotion: true });
  const g = s.geometry;
  const fill = body || s.colors.body, ink = eyes || s.colors.eyes;
  const id = `eu-${expression}${idSuffix}`;
  const shapes = [...g.backPaths, g.headPath, ...g.frontPaths].filter(Boolean).map(r1);
  let viewBox = '-150 -150 300 300';
  if (fit) {
    const xs = [], ys = [];
    for (const d of shapes) { const n = d.match(/-?\d+(\.\d+)?/g).map(Number); for (let i = 0; i + 1 < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); } }
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) + pad - x0, h = Math.max(...ys) + pad - y0;
    const side = Math.max(w, h); // square, centred
    viewBox = [x0 - (side - w) / 2, y0 - (side - h) / 2, side, side].map((v) => Math.round(v * 10) / 10).join(' ');
  }
  const parts = shapes.map((d) => `<path d="${d}" fill="${fill}"/>`).join('');
  const eyesSvg = `<g clip-path="url(#${id})">${g.leftVisible ? `<path d="${r1(g.leftPath)}" fill="${ink}"/>` : ''}${g.rightVisible ? `<path d="${r1(g.rightPath)}" fill="${ink}"/>` : ''}</g>`;
  const dims = size ? ` width="${size}" height="${size}"` : '';
  const a11y = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${dims}${a11y}><defs><clipPath id="${id}"><path d="${r1(g.headPath)}"/></clipPath></defs>${parts}${eyesSvg}</svg>`;
}
