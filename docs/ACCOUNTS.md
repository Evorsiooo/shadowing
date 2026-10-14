# Accounts and Google sign-in

Euno Shadowing uses "Sign in with Google". Every record in D1 belongs to one user, and every
API query is scoped to the signed-in user.

## How it works

- `GET /auth/google?next=/app` starts sign-in (OpenID Connect code flow with PKCE, `state` and
  `nonce`; scopes `openid email profile`). In invite-only mode it first asks for an invite code.
- `GET /auth/google/callback` checks the ID token against Google's keys, finds or creates the
  user, and sets the `__Host-euno_session` cookie (HttpOnly, Secure, SameSite=Lax, 30 days,
  sliding). Only a SHA-256 hash of the cookie is stored, in the `sessions` table.
- `GET|POST /auth/logout` signs out.
- `/app` is the app. Signed-out visitors are sent to Google sign-in and come back.
- `GET /api/me` returns `{ email, name, picture, role }` or 401.
- `DELETE /api/account` with `{ "confirm": "<your email>" }` deletes the account and everything
  the server keeps for it (docs, private values, sessions, R2 files) and revokes its Google Drive access.
- `POST /api/support` with `{ message, email? }` stores a contact-form message (signed in or not;
  rate-limited; Cloudflare Turnstile is checked when `TURNSTILE_SECRET` is set).

### Tables (migration 0003)

| Table | What |
|---|---|
| `users` | id, google_sub, email, name, picture, role (`user`/`admin`), disabled, invite_code, created, last_seen |
| `sessions` | hashed session id, user_id, expiry |
| `docs`, `private` | as before, plus `user_id` in the primary key |
| `files` | owner of each R2 object (new keys are `u/<userId>/…`) |
| `config` | site settings; `signup` is `open` or `invite` |
| `invites` | invite codes: uses, max uses, expiry |
| `support_messages` | contact-form inbox |

Admins: emails in the `ADMIN_EMAILS` variable (wrangler.toml) are always admins. Linking: the
first Google sign-in with a verified email links to an existing user row with that email and no
Google id yet. That is how the pre-accounts data (assigned to evorsio1@gmail.com by the
migration) reaches its owner.

Admin page: admins get an **Admin** button in the app's top bar. It lists accounts (with a
practice-session count, never their data), disables or deletes them, switches sign-up between
open and invite-only, creates and revokes invite codes, and shows the contact-form inbox. Its
routes are `/api/admin/*` (`server/admin.js`); each one re-checks the admin role from the
database. Admin accounts can't be disabled or deleted from there.

Local development: `DEV_NO_AUTH=1` in `.dev.vars` signs you in as `dev@localhost`, and only works
on localhost. `node scripts/test-accounts.mjs` checks, against a local dev server, that one user
can't read, change or delete another user's data, and `node scripts/test-admin.mjs` checks that the
admin routes refuse everyone but admins and do what the admin page needs.

## Setting up Google sign-in

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project called
   **Euno Shadowing**.
2. Open **Google Auth Platform** (APIs & Services → OAuth consent screen) and fill in:
   - **Branding:** app name *Euno Shadowing*, your support email, home page
     `https://shadowing.euno.cc`, privacy policy `https://shadowing.euno.cc/privacy`, terms
     `https://shadowing.euno.cc/terms`, authorised domain `euno.cc`.
   - **Audience:** External. Leave it in *Testing* and add yourself as a test user until launch.
   - **Data access:** the scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
     These are non-sensitive, so no security review is needed.
3. **Clients → Create client → Web application**, named *Euno Shadowing web*. Authorised
   redirect URIs:
   - `https://shadowing.euno.cc/auth/google/callback`
   - `https://<your-project>.pages.dev/auth/google/callback` (until the domain is live)
   - `http://localhost:8788/auth/google/callback` (local development)
4. Copy the client id and secret into the Pages project:
   ```sh
   npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name shadowing
   npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name shadowing
   ```

## Rolling out on the existing database

The migration changes the primary keys, so the old code and the new schema don't work together.
Apply the migration and merge in one sitting:

1. Back up: `npx wrangler d1 export shadowing --remote --output backup-before-accounts.sql`
2. Set the two Google secrets (above).
3. Apply the migration: `npx wrangler d1 migrations apply shadowing --remote`
4. Merge the pull request; Cloudflare deploys it.
5. Redeploy the reminders Worker: `npm run deploy:reminders`
6. Open `/app`, sign in with evorsio1@gmail.com, and check your videos, sessions and reminders.
7. Remove the old `MCP_TOKEN` secret and the MCP connector in claude.ai (the endpoint is gone).
   Cloudflare Access can stay in front until launch; delete the Access application then.
