// Draws the site's icons from Euno himself (src/euno/): run `node scripts/make-icons.mjs` after changing his look.
// Writes src/site/assets/{favicon.svg, favicon-*.png, icon-*.png, apple-touch-icon.png} and src/site/favicon.ico.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import sharp from 'sharp'; // installed with wrangler's and transformers' dependencies

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const code = buildSync({ bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2020', entryPoints: [join(src, 'euno', 'static.mjs')], alias: { 'ajv/dist/2020.js': join(src, 'euno', 'ajv-stub.js') } }).outputFiles[0].text;
const { eunoSvg } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const assets = join(src, 'site', 'assets');
const bare = eunoSvg('attentive-left', { label: null, pad: 4 });
writeFileSync(join(assets, 'favicon.svg'), bare);
// on a tile (home screens crop icons to their own shape, so Euno sits inside the safe area)
const tiled = (inset) => {
  const inner = bare.replace('<svg ', `<svg x="${inset}" y="${inset}" width="${100 - 2 * inset}" height="${100 - 2 * inset}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f6f7f3"/>${inner}</svg>`;
};
const png = (svg, size) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toBuffer();
for (const s of [32, 48, 96]) writeFileSync(join(assets, `favicon-${s}.png`), await png(bare, s));
writeFileSync(join(assets, 'apple-touch-icon.png'), await png(tiled(12), 180));
for (const s of [192, 512]) writeFileSync(join(assets, `icon-${s}.png`), await png(tiled(10), s));
writeFileSync(join(assets, 'icon-maskable-512.png'), await png(tiled(22), 512));

// favicon.ico: PNG images inside an ICO container (supported by every current browser and by search crawlers)
const sizes = [16, 32, 48];
const imgs = await Promise.all(sizes.map((s) => png(bare, s)));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const o = 6 + 16 * i;
  head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(imgs[i].length, o + 8); head.writeUInt32LE(offset, o + 12);
  offset += imgs[i].length;
});
writeFileSync(join(src, 'site', 'favicon.ico'), Buffer.concat([head, ...imgs]));
console.log('icons written');

// the server's own pages (sign-in consent, invites, errors) can't run the build, so they import Euno from here
writeFileSync(join(root, 'server', 'euno-mark.js'), `// Written by scripts/make-icons.mjs: Euno as plain SVG for the server's own pages.\nexport const EUNO_MARK = ${JSON.stringify(eunoSvg('attentive-left', { label: null, idSuffix: '-mark' }))};\n`);
