// Tests the layout check itself: the review screen is broken on purpose in several ways, and every break must be reported.
// Run it after changing scripts/layout/visual.mjs or the harness. A check that passes a broken screen is worse than none.
import { serveDist, launch, newPage, measure } from './layout/harness.mjs';
import { SESSION_SCREENS } from './layout/session-screens.mjs';
import { ALLOW } from './layout/screens.mjs';
import { visual, CANVAS_SPY } from './layout/visual.mjs';

const BREAKS = [
  ['a hole inside the right card', '.rev-foot { margin-top: 120px }', 1895, 935],
  ['the play, volume and note rows spread apart', '.rev-bar.rev-wrap { gap: 50px }', 1895, 935],
  ['space around the play row', '.rev-play { margin: 45px 0 }', 1895, 935],
  ['the Oscar / You / Together bar wider than the card', '.rev-wrap .seg { min-width: 520px }', 1895, 935],
  ['buttons wider than the card', '.review-seg button { min-width: 180px !important; flex: none !important }', 1895, 935],
  ['a title running under the mascot', '.rev-head .row:last-child { margin-right: -76px }', 1366, 768],
  ['a hole between the video and the chart', '#panel { margin-top: 90px }', 1895, 935],
  ['the page scrolls although the screen should fit', '.layout.fit.reviewing { height: 1300px !important }', 1895, 935],
  ['the card pushed past the bottom of the window', '.side .session { min-height: 1100px !important }', 1895, 935],
];
const screen = SESSION_SCREENS.find((s) => s.name === 'Step 3 Record, review of the take');
const { server, url } = await serveDist();
const browser = await launch();
let bad = 0;
const run = async (css, w, h) => {
  const page = await newPage(browser, { width: w, height: h }, {});
  await page.addInitScript(CANVAS_SPY);
  await page.goto(url + screen.path); await page.waitForSelector('#topbar'); await page.waitForTimeout(400);
  await screen.run(page);
  if (css) { await page.addStyleTag({ content: css }); await page.waitForTimeout(400); }
  const found = (await page.evaluate(measure, ALLOW)).concat(await page.evaluate(visual, { fits: true, vp: { width: w, height: h } }));
  await page.context().close();
  return found;
};
try {
  const clean = await run('', 1895, 935);
  if (clean.length) { bad++; console.log('FAIL the unbroken screen is not clean:', JSON.stringify(clean).slice(0, 300)); } else console.log('ok   the unbroken screen is clean');
  for (const [name, css, w, h] of BREAKS) {
    const found = await run(css, w, h);
    if (found.length) console.log(`ok   caught: ${name} (${found.map((f) => f.kind).join(', ')})`);
    else { bad++; console.log(`FAIL NOT caught: ${name}`); }
  }
} finally { await browser.close(); server.close(); }
console.log(bad ? `\n${bad} problem(s)` : '\nthe check catches every deliberate break');
process.exit(bad ? 1 : 0);
