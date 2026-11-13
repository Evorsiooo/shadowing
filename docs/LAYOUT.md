# Layout check

Scrollbar and scaling bugs kept coming back because nothing could see them.

## Why they were missed

- **Headless Chromium hides scrollbars** (Playwright passes `--hide-scrollbars`), and macOS and phones draw thin overlay bars that
  take no room. On Windows every scrollbar is a 15–17px classic bar that takes room from the box. So a box that is "just
  a few pixels too short" looks fine in every test and on a Mac, and shows a bar on Windows.
- Tests only looked at one size, on the first screen.
- Nothing failed when a box overflowed; someone had to notice.

## What checks it now

`npm run build && npm run test:layout` (also run by GitHub on every pull request, `.github/workflows/layout.yml`).
`scripts/test-layout.mjs` signs in to a fake backend with sample data and visits each screen in `scripts/layout/screens.mjs`
at phone, narrow-window, tablet, laptop (also at 150% and 200% Windows scaling) and large sizes, with classic scrollbars on.
It fails when:

1. the page scrolls sideways;
2. any box draws a scrollbar that is not on the `ALLOW` list (the boxes meant to scroll: the Ask Euno log, windows, sidebars, tables);
3. a text field, button, link or text block shows a scrollbar at all;
4. something sticks out past the right edge with no scroller around it;
5. the page scrolls by only a few pixels (48 or fewer) in a window at least 500px tall;
6. a filled card in a grid has a big hole under it because its neighbour is taller;
7. the page throws a script error.

### The session steps are checked with real-looking data (`scripts/layout/session-screens.mjs`, `scripts/layout/visual.mjs`)

The first version of this check only looked at empty or fake screens, so the review of a recorded pass (the screen with the
chart, the sound differences and Redo / Continue) was never drawn with anything in it and broke without anyone knowing.
Every session step now runs with a generated 16:9 video, a speaker pitch line, a finished recording with its own line, three
sound differences (and a 26-difference variant) and a "listen for these" list, at phone, tablet, laptop (several
sizes: 1280x720, 1366x768, 1536x730, 1920x1080, 1895x935) and with Windows scaling. On top of the scrollbar checks, these
screens fail when:

- text is drawn over other text, or over the mascot (the rectangles of every piece of text are compared);
- text is cut off by a box that hides its overflow without an ellipsis;
- a column has a hole of 90px or more between two blocks, or there is more than 40px between the video and the chart;
- a card has more than 50px with nothing drawn in it (measured on drawn text, controls, pictures and filled boxes, not on box edges, because a stretched box can hide a hole), at the top, bottom or between two things;
- a control or line of text runs past the box that clips it (a card, a button bar), so something is cut off, such as the "Together" button of a too-wide Oscar / You / Together bar;
- a screen marked `fits: true` (the review) scrolls the page at 1000x600 or more, or Redo / Continue are below the window;
- the review's list of things to try scrolls inside its card in a window at least 800px tall;
- a label drawn on the pitch chart (it is canvas, so the DOM can't see it) is cut off or overlaps another label.

The video is a generated test pattern in `scripts/layout/fixtures/` (served with Range support so seeking works).
Add a variant there (for example a 4:3 clip) when a layout depends on the video's shape.

The sound differences in the test data are not typed in. They are made by the real matching code (`wordsAt` in `src/js/24-pron.js`),
so a sound is only named on a word that can contain it, and a sound with no word gets a time instead. `npm run test:wordsat`
tests that code on its own.

**The check is tested too.** `npm run test:layout-selftest` breaks the review screen on purpose in nine ways (a hole inside the card,
rows spread apart, an Oscar / You / Together bar wider than the card, buttons wider than the card, a title under the mascot, a hole
between video and chart, the page scrolling, the card pushed below the window...) and fails if any one is not reported. Run it whenever
`scripts/layout/visual.mjs` changes. When you find a new kind of defect by looking, add it to that list first, see it pass unnoticed,
then teach the check.

**These checks do not replace looking.** They found what they were taught to find. Open the screenshots.

`node scripts/test-layout.mjs --shots out` saves a screenshot of every screen. `--only "laptop Ask"` runs a subset.

## Checklist for every UI change (do all of it before opening the pull request)

1. `npm run build && node scripts/test-layout.mjs --shots out` and read the failures. Do not "fix" a failure by adding to `ALLOW`
   unless the box is really meant to scroll.
2. **Open every screenshot of the screens you touched, and their neighbours, at 1895x935, 1366x768, 1280x720 and a phone.**
   Write down each defect you see (a gap, something crooked, text near an edge, a button you'd have to scroll to, a label
   on top of a line, an empty strip, a mascot that looks stuck on). Fix them, then look again. The screenshots are the evidence:
   attach them or the CI artifact to the pull request.
3. Use populated data. An empty chart, a short list and a missing recording hide the layouts that break. If a screen needs a
   state the fixtures don't have (a recording, many differences, a long name, a tall video), add it to `session-screens.mjs`
   or `harness.mjs` as part of the change.
4. When a defect is found by a person and not by the check, add the assertion for it, with the fix.
5. Say in the pull request what was and wasn't checked. Headless Chromium is not Brave on Windows: write "checked in Chromium
   with classic scrollbars", never "verified on Windows".

## When you add or change a screen

Add it to `scripts/layout/screens.mjs` (a name and the steps to reach it). If a box is meant to scroll, add its selector to
`ALLOW` with a reason; otherwise fix the CSS.

## Base rules in `src/styles.css`

- `textarea` never draws a scrollbar (long text still scrolls inside it).
- `body` has `overflow-wrap: break-word`, so a long word or address wraps instead of widening its box.

## What this does not cover

Real Windows, Brave or Safari rendering (fonts and scrollbars differ a little); real speech (the video is a test pattern and the pitch lines are generated); a real recording and microphone; playback sync; screens that need a connected AI key. Add those to the screens as they get fixtures.
