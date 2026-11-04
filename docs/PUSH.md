# Push notification reminders

Reminders can go out as a notification on any device a user turns them on for (Settings → Practice → Reminders),
as well as, or instead of, Discord. Each channel is used when it is set up; the schedule is shared.

## How it works

- `src/site/sw.js` → `/sw.js`: the service worker. It shows each reminder and opens `/app/` when one is
  tapped. It also keeps the app page and its hashed files so the installed app opens offline (never API, sign-in, OAuth or MCP responses). The app registers it on load (`src/js/86-push.js`), which also lets
  browsers offer to install the site as an app.
- Turning notifications on asks for permission, subscribes with the server's VAPID public key, and sends
  the subscription to `POST /api/reminders/push`. The server keeps up to 10 devices per user in the
  `private` table under `pushSubs` (no migration needed). `DELETE /api/reminders/push` removes one;
  signing out removes the current device.
- `server/webpush.js` sends with no libraries: a VAPID JWT (RFC 8292) and aes128gcm encryption
  (RFC 8291), checked against the RFC's test vector by `node scripts/test-webpush.mjs`.
  Only the Chrome/Android (FCM), Firefox, Apple and Windows push services are accepted as endpoints.
  A device the push service reports as gone (404/410) is dropped.
- The reminders Worker sends through the `push` channel in `server/reminders.js` like Discord.

## iPhone and iPad

Safari supports web push (iOS 16.4 and later) only for a site added to the Home Screen and opened from
there. In a normal Safari tab the Reminders page explains how to add it.

## Setup (once)

```
node scripts/push-keys.mjs           # makes a key pair, sets VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
                                     # on the Pages project and the reminders Worker
npm run deploy:reminders             # the Worker picks up the push channel
```

Keep `.secrets/vapid.json`: a new key pair means every device has to turn notifications on again.
For local development, `node scripts/push-keys.mjs --dev` writes the keys to `.dev.vars` instead.
Without the keys the app says notifications aren't available yet, and Discord keeps working.
