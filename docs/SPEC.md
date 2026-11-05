# Euno Shadowing — Product Spec

Updated Oct 14, 2026 for the public launch · @Adrien JALLA

This spec describes Euno Shadowing as it is built and running at **shadowing.euno.cc**. The first version of this document (Oct 10, 2026) described a single-user Claude artifact for Adrien; the practice routine and most features carried over, and the rest has changed as noted below. The original layout mockup is in [mockup.png](mockup.png).

How the pieces work in detail: [ACCOUNTS.md](ACCOUNTS.md) (sign-in, admin) and [STORAGE.md](STORAGE.md) (files and Google Drive). Hosting and setup are in the [README](../README.md).

## Purpose

A web app for daily shadowing practice: you repeat short clips of a model speaker to move your accent towards theirs, and the app keeps time, records you, compares your sounds (English), timing and pitch with theirs, and tracks whether your speech is actually changing.

* **Users:** anyone with a Google account. Each person's data is private to them.
* **Target accents at launch:** English only, with General American, Southern British and General Australian English to choose from. Check-in material and AI prompts are organised per language (`src/js/15-profile.js`), so French, Spanish, Japanese and others can be added later.
* **Interface language:** English. Spelling in AI replies follows the chosen accent.
* **Principle:** every default that research has not settled (clip length, pass counts, session length) is a setting, not hard-coded.

## The practice routine

One 15-minute session a day, 6 days a week, on one clip of 1–2 sentences (10–20 seconds by default).

1. **Listen (2 min):** play the clip 3 times without speaking.
2. **Shadow (7 min):** speak along with the clip, no transcript, about 15 passes.
3. **Record and compare (2 min):** record one pass and compare it with the original.
4. **Shadow again (4 min):** about 8 more passes, then record a final pass and compare it with the step 3 recording.

**Bad-day mode:** a 5-minute version (steps 1–2 with 5 passes). The app nudges towards never skipping two days in a row.

**Copy everything, target only what sticks:** every pass copies rhythm, melody and sounds together. A difference that is still there after several days becomes the focus of step 4. The issues list shows which problems keep coming back.

**Clip rotation (suggested, not enforced):** a new clip Mon, Wed and Fri; repeat the previous day's clip Tue, Thu and Sat.

All durations and pass counts are adjustable in Settings → Practice.

## Getting started

* **Public site** at `/`: landing page, two guides (what shadowing is, a daily routine), privacy policy, terms and a contact form. Pre-rendered static pages with SEO metadata (`src/site/pages.mjs`).
* **Sign in with Google** opens the app at `/app/`. Sign-up is open by default; the admin can switch it to invite-only.
* **Onboarding wizard** on first launch: name, native languages, target accent, where files are kept (Google Drive recommended), a first video, an optional AI key, and the week-0 baseline recording.

## Layout

One main screen with three areas:

* **Video player (left, large):** the video with custom controls and a scrubber along its bottom edge. Clip brackets sit on the scrubber.
* **Videos sidebar (right, tall):** the video library.
* **Analysis panel (below the player):** pitch / waveform view while shadowing; zoomed clip editor while cutting a clip.

The guided session controls sit next to the player. On phone width the sidebar collapses into a drawer and the panel stacks under the player. The top bar has Progress, Check-ins, Settings and, for admins, Admin.

## Video library

* **Add a video** from a file on the device (any length) or a direct link to an .mp4 file. Share pages (Google Drive, MEGA, YouTube, Dropbox) are recognised and explained rather than failing silently. A linked video can be copied into storage so it still plays if the link dies.
* **Per video:** open, open original link, edit title, link and speaker, archive.
* **Archive, never delete by accident:** archived videos move to a collapsible section and can be restored, with their clips and history.
* **List item:** title, speaker, clips done / total, last practised date, and whether the file is on this device or in Drive.

## Player, scrubber and clip brackets

* **Controls:** play/pause, speed (0.5x, 0.75x, 1x, pitch preserved), loop current clip, volume.
* **Scrubber:** each clip is a bracket `[   ]` at its position, with a tick when done. Clicking a bracket selects the clip and jumps to it.
* **Keyboard shortcuts** (space, replay, I/O for clip edges, speed keys) with a help overlay.

## Making clips

1. **Rough selection:** drag on the scrubber, or press I/O while the video plays.
2. **Fine adjustment:** a zoomed waveform of the selection; drag the edges onto pauses, nudge by ±0.1 s, snap to gaps.
3. **Length indicator:** green inside the target range (default 10–20 s), amber just outside, red far outside.
4. **Save** with an optional label, then **Shadow now** or keep cutting. Clips can be queued, edited and archived. Edges that land mid-word get a warning.

## Guided shadowing session

* **Step bar:** Listen → Shadow → Record & compare → Shadow again, with progress.
* **Pass counter per step**, automatic looping with a short gap (default about 1 s), and a session timer.
* **Controls:** pause, repeat a pass, skip a step, end early (progress is saved), switch to bad-day mode.
* **Clip done** after one complete session. A "can't keep up" hint suggests shortening the clip. Optional review runs bring a finished clip back 1–2 days later (off by default).

## Recording and comparing

* The microphone starts with the clip. A headphones reminder shows before recording.
* **Playback:** original only, mine only, original then mine, both together.
* **Kept:** the step 3 and final recording of each session, and every check-in recording. Side-by-side compare and per-clip history.

## Pitch and waveform panel

* **Pitch is the default view**, with a toggle to waveform. Model line on top, learner below, same time axis. Each voice is shown relative to its own average pitch.
* **Model line worked out once** when the clip is saved, and stored with it.
* **Live** pitch while speaking, with start detection; after each pass, loudness cross-correlation aligns the two recordings and measures the lag (behind or ahead). A manual offset and a device-delay setting cover the cases auto-alignment can't.
* **Noisy clips:** the line is smoothed, unreliable stretches are hidden, and a clip can be flagged as noisy.

## "What sounded off" notes and AI feedback

* **Note box on each recorded pass:** what sounded off, plus optional sentence and what you were aiming for.
* **Ask AI (optional, bring your own key):** in Settings → Connections, a user adds an Anthropic, OpenAI or OpenRouter key, picks a model from the provider's own list (a cheap, fast model is the default) and can test it. The server keeps the key encrypted with `KEY_ENCRYPTION_KEY` and never sends it back to the browser, which only sees the last four characters. The reply gives the likely accent feature, what to change, what to listen for, and a short issue name; if the note is too vague the model says so and asks a question. Text only; no audio is sent.
* **Without a key:** "Copy prompt" puts the same prompt on the clipboard for any AI chat, and the reply can be pasted back.
* **Issues list:** recurring problems from the notes, which can be ticked, renamed and merged.

## Progress tracking and check-ins

**Habit:** streak (one rest day allowed), sessions this week against a target (default 6), total minutes, a calendar with bad-day sessions marked, and the "don't skip two days" nudge.

**Check-ins at weeks 0, 4, 8 and 12.** Week 0 is the baseline, prompted during onboarding before the first session. Each records a fixed set of read-aloud sentences, a 60-second retelling, and a 60-second answer to an unseen question. Recordings are never overwritten, and any check-in can be played against the baseline.

**Rough measures** against the model clips: syllable rate, stressed/unstressed length ratio, pitch range in semitones, average lag. Shown as trends and labelled as rough measures, not an accent score.

**Blind listener pack:** a shuffled, unlabelled export of check-in clips plus a model clip, with a rating sheet (1 = no foreign accent, 9 = very strong). Ratings can be entered back in, with an average per check-in.

## Reminders

Per user, in Settings → Practice → Reminders, on two channels that share one schedule: a Discord webhook (with an optional Discord user id so the message pings that person) and push notifications on any device the user turns them on for, up to 10 devices ([PUSH.md](PUSH.md)). On iPhone and iPad, push works once the site is added to the Home Screen. Each user picks the time, an optional second "still time" nudge, the days, and whether to skip days already practised; reminders mention a due check-in. "Send a test" sends straight away. The reminders Worker runs every 15 minutes. Channels sit behind one interface (`server/reminders.js`), so more can be added.

## Accounts and admin

* **Sign-in:** Google (OpenID Connect with PKCE). The session cookie lasts 30 days, sliding. Settings → Data has sign-out and **Delete account**, which removes everything the server keeps and revokes the app's Drive access.
* **Admin** (emails listed in `ADMIN_EMAILS`; today evorsio1@gmail.com): an Admin page lists accounts with a practice-session count (never their data), disables or deletes them, switches sign-up between open and invite-only, creates and revokes invite codes, and shows the contact-form inbox.

## Data and storage

| What | Where |
|-|-|
| Videos, clips, sessions, notes, issues, check-ins, settings | The `docs` table in Cloudflare D1, one JSON document per record, keyed by user |
| Video files and voice recordings | The user's Google Drive ("Euno Shadowing" folder, `drive.file` scope) with a cache in the browser; or, as an opt-in, only in the browser. Never on the server. |
| AI key, Drive refresh token, Discord webhook, push subscriptions | The `private` table, never returned by the docs API. Keys and tokens are sealed with AES-GCM under `KEY_ENCRYPTION_KEY`. |
| Accounts, sessions, invites, contact messages | `users`, `sessions`, `invites`, `support_messages`, `config` |

Backup: Settings → Data exports everything as JSON.

## Limits

These keep one account or one visitor from running up costs or filling the database:

| What | Limit |
|-|-|
| Practice data per account | 25 MB and 20,000 records; one record at most 1 MB. A change that doesn't grow the data always goes through. |
| AI feedback | 60 requests per user per hour |
| Saving an AI key (each save checks the key with the provider) | 10 per user per hour |
| Loading the provider's model list | 30 per user per hour |
| Google Drive access tokens | 120 per user per hour |
| Test reminder | 1 per user per 20 seconds |
| Push notification devices | 10 per user |
| Contact form | 5 per hour per address or account, 300 per day in total, plus a hidden honeypot field. Cloudflare Turnstile is checked when both `TURNSTILE_SECRET` and `TURNSTILE_SITE_KEY` are set (the page fetches the site key from `GET /api/support-config`). |

## Look and feel

Friendly and game-like (Duolingo-inspired, with no Duolingo branding): rounded shapes, chunky buttons, bold green, clear progress bars, small celebrations for finished clips, streaks and check-ins. Light and dark mode. Calm during shadowing itself, with minimal movement on screen.

## Later

* More target languages (French, Spanish, Japanese and others).
* Dropbox and OneDrive next to Google Drive.
* More reminder channels.
* A per-user MCP connector so each person can connect Claude to their own data (the original single-user one was removed).

## Out of scope

* Automatic accent scoring or "how native do you sound" ratings.
* Downloading from YouTube or playing share-page links.
* Transcripts.
* Sharing practice data between users.
