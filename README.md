# Shadowing Practice

A personal web app for a daily 15-minute shadowing routine, built to move Adrien's accent towards General Australian English. The full feature spec is in [docs/SPEC.md](docs/SPEC.md), with the layout mockup in [docs/mockup.png](docs/mockup.png).

## What's in it

All six build stages from the spec are implemented:

1. **Library, clips, session.** Video library (add by direct .mp4 link, link check, edit, archive/restore). Custom player with speed (pitch preserved), clip loop and volume. Scrubber with `[ ]` clip brackets and ticks. Clips are cut by dragging on the scrubber or with the I/O keys. A zoomed waveform editor has draggable edges, ±0.1 s nudges, snap-to-gap, a length indicator and a mid-word warning. Clip queue. Guided 4-step session with pass counter, timer, pause, repeat, skip, end early, bad-day mode and a "can't keep up" hint. Also a practice log, a streak (one rest day allowed), the weekly target and clip rotation suggestions.
2. **Recording and comparing.** The microphone starts with the clip. Playback options: original, mine, original then mine, both together. Step 3 and final recordings are kept, with side-by-side compare and per-clip history.
3. **Pitch and waveform.** YIN pitch tracking, smoothed, with unreliable stretches hidden. Each voice is shown relative to its own average, in two lanes. The model line is worked out once and stored with the clip. Clips can be flagged as noisy.
4. **Live pitch and sync.** Live pitch line with start detection. After each pass, loudness cross-correlation aligns the recording and measures the lag (behind or ahead). A manual offset is used when auto-alignment is unsure. There is also a device-delay setting.
5. **Notes and Claude.** "What sounded off" notes. Ask Claude (Claude API, through the server) for the likely feature, what to change and what to listen for. An issues list supports tick, rename and merge.
6. **Check-ins.** Weeks 0, 4, 8 and 12: fixed read-aloud sentences, a 60 s retelling and a 60 s unseen question. Recordings are never overwritten. Includes baseline comparison, rough objective measures (syllable rate, stressed/unstressed length ratio, pitch range, lag) with trends against the speaker's clips, and a blind listener pack export (shuffled WAVs plus a rating sheet) with ratings entry.

Every routine number (passes, minutes, clip length range, loop gap, offsets, review runs and so on) is a setting.

## How it's hosted

Everything runs on one Cloudflare account, mostly within the free tier:

| Piece | What it does |
|-|-|
| **Cloudflare Pages** | Serves the app (`dist/`) and runs the backend (`functions/`) |
| **Cloudflare Access** | Locks the site to your email: a one-time code, then signed in for 30 days per device. Every API call also checks the Access token itself (`server/auth.js`), so nothing is exposed even if a policy is misconfigured. |
| **D1** | The database: every app record is a JSON document (`migrations/0001_init.sql`) |
| **R2** | Videos and voice recordings, streamed back with range requests so videos seek properly |
| **Claude API** | "Ask Claude" on notes, through the server (`server/claude.js`); the key is a Cloudflare secret |
| **MCP server** | `/mcp/<secret>` gives Claude read/write access to all data and recordings (`functions/mcp/`) |

### API

All routes need a valid Access sign-in.

- `GET /api/health`
- `GET /api/docs`, `PUT|DELETE /api/docs/:collection/:id`
- `POST /api/files` (recordings), `GET|DELETE /api/files/:key`
- `POST /api/uploads` → `PUT /api/uploads/:id/:part` → `POST /api/uploads/:id/complete` (big videos)
- `POST /api/import` (copy a video from a direct link into R2)
- `POST /api/claude` (note feedback)

### MCP tools

`get_overview`, `list_records`, `get_record`, `put_record`, `delete_record`, `query_sql` (read-only), `list_files`, `get_file` (download link, or inline audio).

## Setting it up

1. **Cloudflare account.** In the dashboard, open **Zero Trust** once, pick a team name and choose the **Free** plan.
2. **API token** (My Profile → API Tokens → Create Token → Custom), limited to your account, with:
   - Cloudflare Pages: Edit
   - Workers Scripts: Edit
   - D1: Edit
   - Workers R2 Storage: Edit
   - Access: Apps and Policies: Edit
   - Access: Organizations, Identity Providers, and Groups: Read
3. **Run setup** (re-runnable; it skips anything that already exists):
   ```
   npm install
   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… ANTHROPIC_API_KEY=… npm run setup -- --email you@example.com
   ```
   It creates the database, bucket, Pages project and Access lock, sets the secrets, then builds and deploys. It prints the app URL, and saves the MCP URL in `.secrets/mcp-url.txt` (git-ignored).
4. **Connect Claude:** claude.ai → Settings → Connectors → Add custom connector, and paste the MCP URL.

Later deploys: `npm run deploy`.

### Local development

```
npm install
npx wrangler d1 migrations apply shadowing --local
printf 'DEV_NO_AUTH=1\nMCP_TOKEN=a-long-local-test-token-1234567890\n' > .dev.vars
npm run dev        # http://localhost:8788
```

`DEV_NO_AUTH` only exists in the git-ignored `.dev.vars`, so it never reaches the deployed site. Opened without the server, the app still runs on its own in browser storage.

## Code map

| Server file | What it does |
|-|-|
| `functions/api/[[path]].js` | API routes |
| `functions/mcp/[[path]].js` | MCP server |
| `server/auth.js` | Cloudflare Access token check |
| `server/store.js` | D1 documents, R2 file streaming |
| `server/claude.js` | Claude API call for note feedback |
| `scripts/setup.mjs` | One-shot Cloudflare setup and deploy |
| `scripts/build.mjs` | Builds `dist/index.html` |


| File | What it does |
|-|-|
| `src/js/00-util.js` | DOM helpers, icons, dates, toasts, modal, confetti, zip writer |
| `src/js/10-store.js` | Storage: the server API (D1 + R2), or IndexedDB fallback; settings |
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
