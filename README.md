# Euno Shadowing

A web app for a daily 15-minute shadowing routine: repeat short clips of a model speaker to move your English accent towards theirs. It runs at [shadowing.euno.cc](https://shadowing.euno.cc). Anyone can sign in with Google, and each person's practice data is private to them. The product spec is in [docs/SPEC.md](docs/SPEC.md).

## What's in it

The core of the app: you pick a speaker and cut short clips from your own videos, shadow them in a guided session, and Euno compares your recording with the speaker's audio. For English clips, a Pronunciation tab (beta, off by default, no score) marks up to three places per pass where your sounds differ from the speaker's, runs in the browser on a model downloaded once, and keeps a history of which differences keep coming back ([docs/PRONUNCIATION.md](docs/PRONUNCIATION.md)). Every language also gets timing, pitch and stress comparisons. The app is organised as Today, Library and Progress, with a focus-mode session, **Ask Euno** (a chat page that uses the user's own AI key) and Settings. Euno, the green mascot, is drawn by the avatar engine in `src/euno/`.

The six build stages from the spec, which the app grew out of:

1. **Library, clips, session.** Video library (add by direct .mp4 link, link check, edit, archive/restore). Custom player with speed (pitch preserved), clip loop and volume. Scrubber with `[ ]` clip brackets and ticks. Clips are cut by dragging on the scrubber or with the I/O keys. A zoomed waveform editor has draggable edges, ±0.1 s nudges, snap-to-gap, a length indicator and a mid-word warning. Clip queue. Guided 4-step session with pass counter, timer, pause, repeat, skip, end early, bad-day mode and a "can't keep up" hint. Also a practice log, a streak (one rest day allowed), the weekly target and clip rotation suggestions.
2. **Recording and comparing.** The microphone starts with the clip. Playback options: original, mine, original then mine, both together. Step 3 and final recordings are kept, with side-by-side compare and per-clip history.
3. **Pitch and waveform.** YIN pitch tracking, smoothed, with unreliable stretches hidden. Each voice is shown relative to its own average, in two lanes. The model line is worked out once and stored with the clip. Clips can be flagged as noisy.
4. **Live pitch and sync.** Live pitch line with start detection. After each pass, loudness cross-correlation aligns the recording and measures the lag (behind or ahead). A manual offset is used when auto-alignment is unsure. There is also a device-delay setting.
5. **Notes and AI.** "What sounded off" notes. Ask Euno (with the user's own Anthropic, OpenAI or OpenRouter key, through the server) for the likely feature, what to change and what to listen for, or copy the prompt into any AI chat. An issues list supports tick, rename and merge.
6. **Check-ins.** Weeks 0, 4, 8 and 12: fixed read-aloud sentences, a 60 s retelling and a 60 s unseen question. Recordings are never overwritten. Includes baseline comparison, rough objective measures (syllable rate, stressed/unstressed length ratio, pitch range, lag) with trends against the speaker's clips, and a blind listener pack export (shuffled WAVs plus a rating sheet) with ratings entry.

Every routine number (passes, minutes, clip length range, loop gap, offsets, review runs and so on) is a setting.

## How it's hosted

Everything runs on one Cloudflare account, mostly within the free tier:

| Piece | What it does |
|-|-|
| **Cloudflare Pages** | Serves the public site at `/` and the app at `/app/` (`dist/`), and runs the backend (`functions/`) |
| **Google sign-in** | OpenID Connect with PKCE; sessions in D1 behind an `HttpOnly` cookie. Open sign-up, or invite-only from the admin page ([docs/ACCOUNTS.md](docs/ACCOUNTS.md)) |
| **D1** | The database: users and sessions, and every practice record as a JSON document keyed by user (`migrations/`) |
| **Device storage + Google Drive** | Videos and voice recordings live in each user's Google Drive (`drive.file` scope) with a cache in the browser, or only in the browser as an opt-in (`src/js/17-media.js`, `server/drive.js`, [docs/STORAGE.md](docs/STORAGE.md)). The server never holds them. |
| **AI (optional)** | "Ask Euno" (chat and notes), through the server (`server/ai.js`) with each user's own Anthropic, OpenAI or OpenRouter key, stored encrypted under the `KEY_ENCRYPTION_KEY` secret |
| **MCP server** | `/mcp` lets each user connect Claude, ChatGPT or Gemini to read their own practice data, signed in with OAuth ([docs/MCP.md](docs/MCP.md)) |
| **Reminders Worker** | `workers/reminders/`: posts each user's practice reminders to their Discord webhook and as push notifications ([docs/PUSH.md](docs/PUSH.md)). A Durable Object alarm wakes it every 15 minutes (the account's free cron triggers are used elsewhere); the API re-arms it on every app load through the `REMINDERS` service binding. Webhook URLs and push subscriptions sit in D1's `private` table, which the docs API never returns. Deploy changes with `npm run deploy:reminders`. |

Cloudflare Access only guards preview builds (`*.shadowing-9ex.pages.dev`), because they share the live database.

`KEY_ENCRYPTION_KEY` seals every user's AI key and Drive token. Never change or rotate it: saved keys and Drive connections would stop opening.

### Public site

The landing page, twelve guides (listed on `/guides/`), privacy, terms and contact pages, each in English, French and Spanish, are static HTML pre-rendered by `scripts/build.mjs`, with titles, descriptions, canonical URLs, Open Graph cards and JSON-LD. The app at `/app/` is `noindex`, and `*.pages.dev` copies send `X-Robots-Tag: noindex` so only shadowing.euno.cc is indexed.

Both the public pages and the app have a strict Content-Security-Policy whose inline scripts are pinned by hash: the public pages' in `_headers`, the app's in a `<meta>` tag in `dist/app/index.html`. Both are generated by `npm run build`, so rebuild after any change to `src/` and commit `dist/`.

The app's script and styles are minified into `dist/assets/h/` under content-hashed names, as are the fonts (Rubik and Nunito, served from this site rather than Google Fonts; licences in `src/fonts/`). Those files are cached for a year, so browsers download them again only after they change. The app page itself is always revalidated, and it starts its first two API requests before the app script has arrived.

### API

Everything except `POST /api/support` needs a signed-in user, and every query is scoped to that user. Writes from other sites are refused.

- `GET /api/health`, `GET /api/me`, `DELETE /api/account` (`{ confirm: "<email>" }`)
- `GET /api/docs`, `PUT|DELETE /api/docs/:collection/:id`
- `GET|DELETE /api/drive` (Drive sync status; disconnect), `POST /api/drive/token` (short-lived Drive token for the browser); connecting is `GET /auth/drive`
- `GET/PUT/DELETE /api/ai`, `GET /api/ai/models`, `POST /api/ai/test`, `POST /api/ai/feedback` (bring-your-own-key AI)
- `GET|PUT /api/reminders` (webhook set or not; save/remove it), `POST|DELETE /api/reminders/push` (this device's notifications), `POST /api/reminders/test`, `POST /api/reminders/arm`
- `POST /api/support` (contact form, signed in or not)
- `/api/admin/*` (admins only: users, sign-up mode, invites, support inbox)
- Sign-in: `GET /auth/google`, `GET /auth/google/callback`, `GET|POST /auth/logout`

### MCP tools

All read-only and scoped to the signed-in user: `get_overview`, `list_records`, `get_record`, `search`, `fetch`, `get_pronunciation_progress`, `get_clip_pronunciation`. See [docs/MCP.md](docs/MCP.md).
Per-user limits (practice data size, AI calls, key checks, Drive tokens, contact form) are listed in [docs/SPEC.md](docs/SPEC.md#limits).

## Setting it up

The site deploys from GitHub: Cloudflare rebuilds it on every push to `main`, and other branches get preview links.

1. **Connect the repo.** Go to **Workers & Pages → Create → Pages → Connect to Git**, authorise GitHub and pick this repo, then fill in:
   - Project name: `shadowing`
   - Production branch: `main`
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`

   The first build may fail because the database doesn't exist yet. That's expected.
2. **Google OAuth client:** follow "Setting up Google sign-in" in [docs/ACCOUNTS.md](docs/ACCOUNTS.md), and add the `drive.file` scope for Drive sync.
3. **API token** (My Profile → API Tokens → Create Token → Custom), limited to your account, with Cloudflare Pages: Edit, Workers Scripts: Edit and D1: Edit.
4. **Run setup** (re-runnable; it skips anything that already exists):
   ```
   npm install
   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… KEY_ENCRYPTION_KEY=$(openssl rand -base64 32) npm run setup
   ```
   It creates the D1 database, applies the migrations, sets the secrets and writes the database id into `wrangler.toml`.
5. **Deploy the reminders Worker:** `npm run deploy:reminders`.
6. **Commit `wrangler.toml` and merge it to `main`.** Cloudflare redeploys with everything connected. Admins are the emails in `ADMIN_EMAILS` in `wrangler.toml`.

### Local development

```
npm install
npx wrangler d1 migrations apply shadowing --local
printf 'DEV_NO_AUTH=1\nKEY_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)" > .dev.vars
npm run dev        # http://localhost:8788
```

`DEV_NO_AUTH` signs you in as `dev@localhost` and only works on localhost, so it does nothing on the deployed site. Leave it out to run `node scripts/test-accounts.mjs` and `node scripts/test-admin.mjs`, which check that users can't reach each other's data and that admin routes are admin-only. Opened without the server, the app still runs on its own in browser storage.

## Licence

Euno Shadowing is open source under the [GNU Affero General Public License v3.0](LICENSE). The mascot's animation engine in `src/euno/engine/` comes from the [Bible Strong avatar lab](https://github.com/smontlouis/bible-strong-avatar-lab) (AGPL-3.0, by Stéphane Montlouis-Calixte), which is why the whole app is AGPL. Third-party models, libraries and fonts keep their own licences, listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). The source of the running site is at https://github.com/Evorsiooo/shadowing.

## Code map

| Server file | What it does |
|-|-|
| `functions/api/[[path]].js` | API routes |
| `functions/mcp.js`, `server/mcp.js` | MCP server and its tools |
| `functions/oauth/`, `functions/.well-known/`, `server/oauth.js` | OAuth for the MCP server |
| `functions/auth/[[path]].js` | Google sign-in, sign-out and connecting Drive |
| `functions/app/_middleware.js` | Sends signed-out visitors to sign-in before the app |
| `server/auth.js` | Google ID token checks, sessions, users and invites |
| `server/admin.js` | Admin page routes: users, sign-up mode, invites, support inbox |
| `server/limits.js` | Per-user rate limits |
| `server/store.js` | D1 documents |
| `server/drive.js` | Google Drive connection: sealed refresh token, short-lived access tokens |
| `server/crypto.js` | Seals per-user secrets with `KEY_ENCRYPTION_KEY` |
| `server/ai.js` | Encrypted per-user AI keys, model lists, note feedback and Ask Euno answers (Anthropic, OpenAI, OpenRouter) |
| `server/reminders.js` | When a reminder is due, its message, sending it to Discord and devices |
| `server/webpush.js` | Web Push (VAPID signing and payload encryption) |
| `workers/reminders/` | The reminders Worker (Durable Object alarm scheduler) |
| `scripts/setup.mjs` | One-shot Cloudflare setup (database, migrations, secrets) |
| `scripts/build.mjs` | Builds the app (`dist/app/index.html` plus its hashed script and styles in `dist/assets/h/`), the public site pages, `robots.txt`, `sitemap.xml`, `llms.txt`, the web manifest and `_headers` |
| `src/euno/` | Euno, the mascot: his definition (`euno.avatar.json`) and the animation engine he runs on (`engine/`, copied from the Bible Strong avatar lab by Stéphane Montlouis-Calixte, AGPL-3.0, with its own `LICENSE`) |
| `scripts/make-icons.mjs` | Redraws the favicons, app icons and the server pages' Euno from his definition |
| `src/fonts/` | Rubik and Nunito (Latin subsets, woff2) and their SIL Open Font Licences |
| `src/site/` | Public site: page content and SEO data (`pages.mjs`), styles, the sign-in/contact script and icons. The canonical URL and sign-in link are in `SITE` at the top of `pages.mjs`. |


| File | What it does |
|-|-|
| `src/js/00-util.js` | DOM helpers, icons, dates, toasts, modal, confetti, zip writer |
| `src/js/05-euno.js` | Euno in the app: one live avatar per place he appears, with a mood for each state |
| `src/js/10-store.js` | Storage: the server API (D1), or IndexedDB fallback; settings |
| `src/js/15-profile.js` | Learner profile and per-language content (accents, check-in sentences and questions) |
| `src/js/17-media.js` | Video and recording files: device storage, Google Drive sync, Settings → Data |
| `src/js/20-dsp.js` | Pitch (YIN), loudness, pauses, alignment, rough measures, WAV encoder |
| `src/js/25-mp4audio.js` | Reads the sound out of long MP4 files without loading the whole video |
| `src/js/30-audio.js` | Decoding video sound, microphone, recording |
| `src/js/40-player.js` | Player, controls, scrubber, brackets, clip selection |
| `src/js/50-panel.js` | Pitch/waveform lanes and the zoomed clip editor |
| `src/js/60-library.js` | Video library sidebar and clip list |
| `src/js/70-session.js` | Guided session engine, pass analysis, review card |
| `src/js/80-notes.js` | Notes, Euno's feedback on them, issues, compare, history |
| `src/js/83-nav.js` | Top bar, account menu, page routing (`#today`, `#library`, `#progress/…`, `#settings/…`, `#ask`) and the session's focus bar |
| `src/js/84-today.js` | The Today screen: today's clip, the plan, the week and what to listen for |
| `src/js/85-progress.js` | Streak, calendar, check-ins, measures, listener pack |
| `src/js/87-ask.js` | Ask Euno: a short chat about your own practice, kept with your data |
| `src/js/87-ai.js` | Settings → Connections: provider, key, model, test |
| `src/js/88-settings.js` | Settings, backup, account, device checks, shortcuts |
| `src/js/89-admin.js` | Admin page |
| `src/js/90-onboarding.js` | First-launch wizard |
| `src/js/99-main.js` | Boot and keyboard shortcuts |
