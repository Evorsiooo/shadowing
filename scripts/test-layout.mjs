// Layout check: opens the app at phone, laptop and large sizes with classic (always visible) scrollbars and fails when a screen
// scrolls sideways, draws a scrollbar where none is meant to be, or lets something stick out. node scripts/test-layout.mjs [--shots dir] [--only text]
// Needs dist/ (npm run build) and Playwright's Chromium. See docs/LAYOUT.md.
import { mkdirSync } from 'node:fs';
import { serveDist, launch, VIEWPORTS, newPage, measure } from './layout/harness.mjs';
import { SCREENS, ALLOW } from './layout/screens.mjs';
import { visual, CANVAS_SPY } from './layout/visual.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const shots = opt('--shots'), only = opt('--only');
if (shots) mkdirSync(shots, { recursive: true });

const { server, url } = await serveDist();
const browser = await launch();
const TIMEOUT = 8000;
let bad = 0, runs = 0;
try {
  for (const vp of VIEWPORTS) {
    for (const screen of SCREENS) {
      if (only && !(`${vp.name} ${screen.name}`).includes(only)) continue;
      if (screen.skip && screen.skip(vp)) continue;
      if (vp.sessionOnly && !screen.session) continue; // the big laptop and desktop sizes are for the session screens
      for (const theme of screen.themes || ['light']) {
        const page = await newPage(browser, vp, { empty: screen.empty, theme });
        page.setDefaultTimeout(TIMEOUT);
        if (screen.session) await page.addInitScript(CANVAS_SPY);
        const label = `${vp.name} ${vp.width}x${vp.height} · ${screen.name}${theme === 'dark' ? ' · dark' : ''}`;
        try {
          await page.goto(url + (screen.path || '/app/'), { waitUntil: 'load' });
          await page.waitForSelector(screen.ready || '#topbar', { timeout: 15000 });
          await page.waitForTimeout(400);
          if (!screen.path && await page.locator('text=The server isn’t ready').count()) throw new Error('the app did not start (the fake backend is wrong)');
          if (!screen.path && !screen.empty && await page.locator('.modal-back.obpage').count()) throw new Error('the setup wizard opened instead of the screen (sample data is not marked as set up)');
          await screen.run(page, vp);
          await page.waitForTimeout(500); // animations finish
          const found = (await page.evaluate(measure, ALLOW.concat(screen.allow || []))).concat(screen.check ? await screen.check(page, vp) : []).concat(screen.session ? await page.evaluate(visual, { fits: !!screen.fits && vp.width >= 1000 && vp.height >= 600, vp: { width: vp.width, height: vp.height } }) : []);
          for (const e of page.errors) found.push({ kind: 'script-error', detail: e });
          runs++;
          if (shots) await page.screenshot({ path: `${shots}/${vp.name.replace(/ /g, '-')}_${screen.name.replace(/[^a-z0-9]+/gi, '-')}${theme === 'dark' ? '_dark' : ''}.png` });
          if (found.length) { bad++; console.log(`FAIL ${label}`); for (const f of found) console.log(`     ${f.kind}${f.el ? ' · ' + f.el : ''}${f.detail ? ' · ' + f.detail : ''}`); }
          else console.log(`ok   ${label}`);
        } catch (e) { bad++; runs++; console.log(`FAIL ${label}\n     could not check: ${e.message.split('\n')[0]}`); }
        await page.context().close();
      }
    }
  }
} finally { await browser.close(); server.close(); }
console.log(`\n${runs - bad} of ${runs} screens clean`);
process.exit(bad ? 1 : 0);
