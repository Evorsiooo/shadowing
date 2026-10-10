# Shadowing Practice

A personal web app for a daily 15-minute shadowing routine, built to move Adrien's accent towards General Australian English. The full feature spec is in [docs/SPEC.md](docs/SPEC.md), with the layout mockup in [docs/mockup.png](docs/mockup.png).

## What's in it

All six build stages from the spec are implemented:

1. **Library, clips, session.** Video library (add by direct .mp4 link, link check, edit, archive/restore). Custom player with speed (pitch preserved), clip loop and volume. Scrubber with `[ ]` clip brackets and ticks. Clips are cut by dragging on the scrubber or with the I/O keys. A zoomed waveform editor has draggable edges, ±0.1 s nudges, snap-to-gap, a length indicator and a mid-word warning. Clip queue. Guided 4-step session with pass counter, timer, pause, repeat, skip, end early, bad-day mode and a "can't keep up" hint. Also a practice log, a streak (one rest day allowed), the weekly target and clip rotation suggestions.
2. **Recording and comparing.** The microphone starts with the clip. Playback options: original, mine, original then mine, both together. Step 3 and final recordings are kept, with side-by-side compare and per-clip history.
3. **Pitch and waveform.** YIN pitch tracking, smoothed, with unreliable stretches hidden. Each voice is shown relative to its own average, in two lanes. The model line is worked out once and stored with the clip. Clips can be flagged as noisy.
4. **Live pitch and sync.** Live pitch line with start detection. After each pass, loudness cross-correlation aligns the recording and measures the lag (behind or ahead). A manual offset is used when auto-alignment is unsure. There is also a device-delay setting.
5. **Notes and Claude.** "What sounded off" notes. Ask Claude (inside the artifact) for the likely feature, what to change and what to listen for. An issues list supports tick, rename and merge.
6. **Check-ins.** Weeks 0, 4, 8 and 12: fixed read-aloud sentences, a 60 s retelling and a 60 s unseen question. Recordings are never overwritten. Includes baseline comparison, rough objective measures (syllable rate, stressed/unstressed length ratio, pitch range, lag) with trends against the speaker's clips, and a blind listener pack export (shuffled WAVs plus a rating sheet) with ratings entry.

Every routine number (passes, minutes, clip length range, loop gap, offsets, review runs and so on) is a setting.

## Two ways to run it

The same page runs in both places and adapts:

| | Claude artifact (`dist/artifact.html`) | Standalone (`dist/index.html`) |
|-|-|-|
| Data | Artifact database: synced across devices | This browser (IndexedDB); export/import backup |
| Recordings | Artifact file storage | This browser |
| Ask Claude | Built in (uses your plan) | "Copy prompt" and paste the reply back |
| Microphone | **Blocked by the artifact sandbox**: upload recordings instead | Works |
| Video from pomf etc. | **Blocked by the artifact's security rules**: play the file from the device, or store a copy under 20 MB | Works if the link plays; pitch/waveform need the host to allow CORS, or load the file locally |

**Settings → Device checks** runs the spec's "test first" list on the device you're using and reports what works.

## Build

```
node scripts/build.mjs
```

This concatenates `src/styles.css` and `src/js/*.js` (in file-name order) into `src/index.html`. It writes `dist/artifact.html` (page body for publishing as an artifact) and `dist/index.html` (a complete standalone page). No dependencies.

To use the standalone version, open `dist/index.html` over http(s). For example, enable GitHub Pages on this repo, or run `npx http-server dist`. The microphone needs https or localhost.

## Code map

| File | What it does |
|-|-|
| `src/js/00-util.js` | DOM helpers, icons, dates, toasts, modal, confetti, zip writer |
| `src/js/10-store.js` | Storage: artifact db + assets, or IndexedDB; settings |
| `src/js/20-dsp.js` | Pitch (YIN), loudness, pauses, alignment, rough measures, WAV encoder |
| `src/js/30-audio.js` | Decoding video sound, microphone, recording |
| `src/js/40-player.js` | Player, controls, scrubber, brackets, clip selection |
| `src/js/50-panel.js` | Pitch/waveform lanes and the zoomed clip editor |
| `src/js/60-library.js` | Video library sidebar and clip list |
| `src/js/70-session.js` | Guided session engine, pass analysis, review card |
| `src/js/80-notes.js` | Notes, Claude feedback, issues, compare, history |
| `src/js/85-progress.js` | Streak, calendar, check-ins, measures, listener pack |
| `src/js/88-settings.js` | Settings, backup, device checks, shortcuts |
| `src/js/99-main.js` | Boot and keyboard shortcuts |
