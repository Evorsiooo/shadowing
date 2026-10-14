# MCP server

Anyone with an account can connect Claude, ChatGPT or Gemini to Euno Shadowing at `https://shadowing.euno.cc/mcp`. The app can then read that user's practice data, and nothing else. Users find the address and the setup steps in **Settings → Connected apps**, where they can also disconnect an app.

## How a connection works

1. The AI app calls `/mcp` and gets a `401` whose `WWW-Authenticate` header points to `/.well-known/oauth-protected-resource/mcp`. That document names this site as the authorization server (`/.well-known/oauth-authorization-server`).
2. The app registers itself at `POST /oauth/register` (dynamic client registration, RFC 7591). Registration needs no account, so it is capped at 300 new apps an hour across the site; apps nobody approved are deleted after a day. Every client is public (`token_endpoint_auth_method: none`). Gemini asks for `client_secret_basic`; it is registered as public anyway, and gets no secret.
3. The user is sent to `/oauth/authorize`. If they aren't signed in, they go through Google sign-in first, then come back to the consent page. That page names the app, where it will return to, and what it can read.
4. On **Allow**, the app gets a one-use code (5 minutes, PKCE S256 required). It trades the code at `POST /oauth/token` for an access token (1 hour) and a refresh token (60 days, replaced on every use).
5. The app calls `/mcp` with `Authorization: Bearer <token>`. Each token belongs to one user, and every query filters on that user's id.

Codes and tokens are random. Only their SHA-256 hashes are stored (`migrations/0005_mcp_oauth.sql`). Disconnecting in Settings, deleting the account, or disabling the account stops the app's tokens immediately.

## Which apps can connect

Registration only accepts redirects to the supported apps:

| App | Redirect |
|-|-|
| Claude (web, desktop, mobile) | `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback` |
| ChatGPT | `https://chatgpt.com/connector…` |
| Gemini | `https://oauth-redirect.googleusercontent.com/…`, plus its sandbox and test relays, and `gemini.google.com` |
| Claude Code, Gemini CLI, other local tools | `http://localhost:<any port>/…`, `http://127.0.0.1:<any port>/…` |

A lookalike site can't register, so it can't send someone a consent link that ends with their token on that site. To allow another app without a code change, set `MCP_EXTRA_REDIRECTS` (comma-separated `https://` URL prefixes) as a Pages variable.

## Tools

All tools are marked read-only (`readOnlyHint`). They never return the `private` table (Discord webhook, AI keys, Drive tokens), and recordings stay on the user's device and Drive.

| Tool | What it returns |
|-|-|
| `get_overview` | Streak, this week, minutes, clips, open issues, check-ins, lag by week, recent sessions, settings |
| `list_records` | One collection, newest first, with an optional exact-match filter. Pitch arrays are shortened unless `full` is set. |
| `get_record` | One record in full |
| `search` | Notes, issues, clips and videos matching some words. Ids look like `notes:abc` (the shape ChatGPT expects). |
| `fetch` | One record by a `search` id |

## Testing

```
npm run build && npx wrangler d1 migrations apply shadowing --local && npx wrangler pages dev
node scripts/test-mcp.mjs
```

The script makes two throwaway users. It runs the full sign-in for each, as Claude and as Gemini, and checks that neither can read, find or disconnect the other's data. It also covers code reuse, wrong PKCE verifiers, refresh-token rotation, cross-site approval, and disconnected or disabled accounts.

## Client notes (October 2026)

- **Claude:** Settings → Connectors → Add custom connector. It needs the `401` with `resource_metadata`, a refresh token, and form-encoded token requests. It also supports Client ID Metadata Documents, but falls back to registration when the server doesn't advertise them.
- **ChatGPT:** custom apps need Developer mode, on a paid plan. ChatGPT sends the RFC 8707 `resource` parameter, which must be `https://shadowing.euno.cc/mcp`.
- **Gemini:** Settings → Connected apps → Add a custom app. Leave Client ID and secret empty, and Gemini registers itself. It sends the client id in an HTTP Basic header at `/oauth/token`.
