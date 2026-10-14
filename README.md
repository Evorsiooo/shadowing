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
| **Cloudflare Pages** | Serves the public site at `/` and the app at `/app/` (`dist/`), and runs the backend (`functions/`) |
| **Cloudflare Access** | Locks the site to your email: a one-time code, then signed in for 30 days per device. Every API call also checks the Access token itself (`server/auth.js`), so nothing is exposed even if a policy is misconfigured. |
| **D1** | The database: every app record is a JSON document (`migrations/0001_init.sql`) |
| **Device storage + Google Drive** | Videos and voice recordings stay in the browser's own storage on each device, with optional sync to the user's Google Drive (`src/js/17-media.js`, `server/drive.js`, [docs/STORAGE.md](docs/STORAGE.md)). The server never holds them. R2 is read-only until the old files are moved out. |
| **AI (optional)** | "Ask AI" on notes, through the server (`server/ai.js`) with each user's own Anthropic, OpenAI or OpenRouter key, stored encrypted under the `KEY_ENCRYPTION_KEY` secret |
| **MCP server** | `/mcp/<secret>` gives Claude read/write access to all data and recordings (`functions/mcp/`) |
| **Reminders Worker** | `workers/reminders/`: posts practice reminders to a Discord webhook. A Durable Object alarm wakes it every 15 minutes (the account's free cron triggers are used elsewhere); the API re-arms it on every app load through the `REMINDERS` service binding. The webhook URL sits in D1's `private` table, which the docs API and MCP never return. Deploy changes with `npm run deploy:reminders`. |

### Public site

The landing page, two guides (`/what-is-shadowing/`, `/accent-shadowing/`), privacy, terms and contact pages are static HTML pre-rendered by `scripts/build.mjs`, with titles, descriptions, canonical URLs, Open Graph cards and JSON-LD. The app at `/app/` is `noindex`, and `*.pages.dev` copies send `X-Robots-Tag: noindex` so only shadowing.euno.cc is indexed. The pages get a strict Content-Security-Policy; if you edit `src/site/site.css` or the inline theme script, rebuild so the hashes in `_headers` match.

### API

All routes need a valid Access sign-in.

- `GET /api/health`
- `GET /api/docs`, `PUT|DELETE /api/docs/:collection/:id`
- `GET|DELETE /api/drive` (Drive sync status; disconnect), `POST /api/drive/token` (short-lived Drive token for the browser); connecting is `GET /auth/drive`
- `GET/PUT/DELETE /api/ai`, `GET /api/ai/models`, `POST /api/ai/test`, `POST /api/ai/feedback` (bring-your-own-key AI)
- `GET|PUT /api/reminders` (webhook set or not; save/remove it), `POST /api/reminders/test`, `POST /api/reminders/arm`

### MCP tools

`get_overview`, `list_records`, `get_record`, `put_record`, `delete_record`, `query_sql` (read-only), `list_files`, `get_file` (download link, or inline audio).

## Setting it up

The site deploys from GitHub: Cloudflare rebuilds it on every push to `main`. Database, storage, Access and secrets are set up once by `scripts/setup.mjs`.

1. **Zero Trust.** In the Cloudflare dashboard, open **Zero Trust** once, pick a team name and choose the **Free** plan.
2. **Connect the repo.** Go to **Workers & Pages → Create → Pages → Connect to Git**, authorise GitHub and pick this repo, then fill in:
   - Project name: `shadowing`
   - Production branch: `main`
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`

   The first build may fail because the database doesn't exist yet. That's expected.
3. **API token** (My Profile → API Tokens → Create Token → Custom), limited to your account, with:
   - Cloudflare Pages: Edit
   - Workers Scripts: Edit
   - D1: Edit
   - Access: Apps and Policies: Edit
   - Access: Organizations, Identity Providers, and Groups: Read
4. **Run setup** (re-runnable; it skips anything that already exists):
   ```
   npm install
   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… ANTHROPIC_API_KEY=… npm run setup -- --email you@example.com
   ```
   It creates the D1 database, locks the site with Access and sets the secrets. It also writes the database id and Access settings into `wrangler.toml`, and saves the MCP URL in `.secrets/mcp-url.txt` (git-ignored).
5. **Commit `wrangler.toml` and merge it to `main`.** Cloudflare redeploys with everything connected.
6. **Connect Claude:** claude.ai → Settings → Connectors → Add custom connector, and paste the MCP URL.

From then on, merging to `main` deploys. Other branches get preview links, also behind Access.

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
| `server/store.js` | D1 documents |
| `server/drive.js` | Google Drive connection: sealed refresh token, short-lived access tokens |
| `server/crypto.js` | Seals per-user secrets with `KEY_ENCRYPTION_KEY` |
| `server/ai.js` | Encrypted per-user AI keys, model lists and note feedback (Anthropic, OpenAI, OpenRouter) |
| `server/reminders.js` | When a reminder is due, its message, posting to Discord |
| `workers/reminders/` | The reminders Worker (Durable Object alarm scheduler) |
| `scripts/setup.mjs` | One-shot Cloudflare setup (database, storage, Access, secrets) |
| `scripts/build.mjs` | Builds the app into `dist/app/index.html`, the public site pages, `robots.txt`, `sitemap.xml`, the web manifest and `_headers` |
| `src/site/` | Public site: page content and SEO data (`pages.mjs`), styles, the sign-in/contact script and icons. The canonical URL and sign-in link are in `SITE` at the top of `pages.mjs`. |


| File | What it does |
|-|-|
| `src/js/00-util.js` | DOM helpers, icons, dates, toasts, modal, confetti, zip writer |
| `src/js/10-store.js` | Storage: the server API (D1), or IndexedDB fallback; settings |
| `src/js/17-media.js` | Video and recording files: device storage, Google Drive sync, Settings → Storage |
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
