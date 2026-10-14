# Storage: Google Drive, with a copy in the browser

Videos and voice recordings never go to the server. The server's D1 database only keeps
practice data (videos' titles and clips, sessions, notes, check-ins, settings) and, for users
who turn on Drive sync, a sealed Google refresh token.

## How it works

- **Media documents.** Every file is a document in the `media` collection
  (`{ name, type, size, kind, providers }`) and is referred to as `media:<id>`. A video points
  at its file with `fileRef`; a recording with `ref`.
- **On this device.** The bytes are kept in the browser's Origin Private File System, or in
  IndexedDB where OPFS can't be written from the page (`DeviceFiles` in `src/js/17-media.js`).
  The app asks the browser for persistent storage (Chrome decides by itself and usually says no for
  new sites; nothing depends on it).
- **Google Drive (the default home).** Onboarding recommends connecting it, and so does Settings → Storage.
  Without it, files stay in the browser only. "Keep files only in this browser" in Settings → Storage
  is the opt-in for people who don't want Drive (`meta/storage.deviceOnly`); it stops the reminders.
  With Drive on, the browser copy is only a cache. The app asks for the
  `drive.file` scope, which only covers files the app itself creates; Google lists it as
  non-sensitive, so no security review is needed. Files go into a "Euno Shadowing" folder in the
  user's Drive. `providers.gdrive` records each file's Drive id.
  - Connecting: `GET /auth/drive` (a Google consent screen in a small window) comes back
    through the same `/auth/google/callback` as sign-in. The refresh token is sealed with
    AES-GCM under `KEY_ENCRYPTION_KEY`, bound to the user id (`server/crypto.js`), and stored in
    `private` under `drive`.
  - The browser asks `POST /api/drive/token` for an access token (about an hour) and talks to
    the Drive API directly: resumable uploads in 8 MB pieces, and downloads streamed into device
    storage.
  - A device without a copy downloads the file once, then plays the local copy.
  - Disconnecting (`DELETE /api/drive`) and deleting the account revoke the token at Google.
    Files already in Drive stay there.
- **Missing files.** If a device has no copy and Drive isn't connected, the player says so and
  offers to connect Drive or re-add the file.
- **Adding videos.** "A file on this device" saves the file; "From a link" either plays the link
  or, with "Keep a copy", downloads it in the browser (only works when the site allows it).
  The server no longer downloads links (`/api/import` is gone).
- **More providers.** Dropbox and OneDrive can be added as another entry in `PROVIDERS` with the
  same calls (`upload`, `download`, `remove`, `connected`) and their own `providers.<id>`.

## The old R2 files

Before accounts, files went to R2. R2 is now read-only (`GET|DELETE /api/files/:key`).
Settings → Storage shows "Files in the old server storage" when any are left:

1. **Move N files to Drive** (needs Drive connected). The server copies each file straight from R2
   into the user's Drive folder (`POST /api/drive/copy-old`, one file per request, so a big video
   never passes through the browser). Then the app points the videos and recordings at the Drive
   copy. The server copy stays. If it stops partway, pressing Move again carries on from there.
2. **Delete the server copies** appears once the moved files are in Drive.

After that, the `files` table and the `FILES` binding can be dropped.

## Setup (once)

1. **Encryption key** (shared with bring-your-own-key AI; set it once, never change it, or
   stored tokens and keys can't be read):
   ```sh
   openssl rand -base64 32 | npx wrangler pages secret put KEY_ENCRYPTION_KEY --project-name shadowing
   ```
2. **Google Cloud console**, same project and OAuth client as sign-in:
   - APIs & Services → Library → **Google Drive API** → Enable.
   - Google Auth Platform → Data access → Add or remove scopes → tick
     `.../auth/drive.file` ("See, edit, create, and delete only the specific Google Drive files
     you use with this app") → Update → Save.
   - No new redirect URI is needed; Drive uses `/auth/google/callback`.
   - While the app is in Testing, only listed test users can connect Drive.

## Local development

Put `KEY_ENCRYPTION_KEY` (and the Google client id and secret) in `.dev.vars`.
`node scripts/test-accounts.mjs` also checks that Drive connections are per user.
