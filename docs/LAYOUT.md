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

`node scripts/test-layout.mjs --shots out` saves a screenshot of every screen. `--only "laptop Ask"` runs a subset.

## When you add or change a screen

Add it to `scripts/layout/screens.mjs` (a name and the steps to reach it). If a box is meant to scroll, add its selector to
`ALLOW` with a reason; otherwise fix the CSS.

## Base rules in `src/styles.css`

- `textarea` never draws a scrollbar (long text still scrolls inside it).
- `body` has `overflow-wrap: break-word`, so a long word or address wraps instead of widening its box.

## What this does not cover

Real Windows, Brave or Safari rendering; a real playing video (the sample clips point at a link that doesn't load, so the video
player shows its error state, not a 16:9 picture); the recording and review steps of a session; screens that need a connected AI key
or real recordings. Add those to `screens.mjs` as they get fixtures.
