# TASK042B protected GitHub sync, contract v1

The PWA is fully local without a server. The production endpoint is intentionally
blank in `party-game/index.html` (`meta[name=quip-dictionary-api]`). There is no
GitHub PAT, App private key, installation token, OAuth secret or password in any
browser asset. No real GitHub submission is claimed until a server receipt is
validated by the client.

## Required deployment

Deploy an HTTPS service implementing this contract and the tested `service.cjs`
core, plus these three durable adapters. This repository does not have that
server, GitHub App installation or session configuration deployed.

1. **GitHub App / OAuth authentication.** Register an owner-controlled GitHub App,
   install it only on `Demian-rus/quantum-portal`, with Contents + Pull requests
   read/write and Metadata read. Keep the RSA private key, App ID, installation
   ID, OAuth client secret and signing keys exclusively in the server's secret
   store. Use short-lived installation tokens. `/auth/github/start` creates
   random, expiring OAuth state bound to the browser session; callback verifies
   state and PKCE where supported, exchanges the authorization code on the server,
   resolves the login from GitHub, and checks repository permission. Only the
   exact login `Demian-rus` with write/maintain/admin repository access is allowed.
   Never trust a browser-provided login or owner flag. Rotate the session ID at
   login; return a Secure, HttpOnly cookie with a short expiry. Prefer a same-site
   game/API deployment with SameSite=Lax. A cross-site deployment needs
   SameSite=None plus browser acceptance of the cookie; verify this on the actual
   Android browser before enabling the endpoint.
2. **Server adapter.** Bind the allowed PWA origin to the published game's origin,
   reject every other Origin, set credentials CORS only for that exact origin,
   use a random per-session CSRF token and verify it on all POSTs. Use no-store
   on API responses. Rate-limit owner submissions, cap request bodies at 20 KB,
   redact credentials in logs. Serve a logout route invalidating the session.
3. **Durable idempotency ledger + App writer.** `ledger.once(owner:key, fn)` is an
   atomic durable operation, serialized across service instances. Save receipts
   indexed by `submissionId`, owner and key. `app.stageDraft` must find-or-create
   the deterministic staging branch, compare the exact existing file content,
   and find-or-create its Draft PR. Recover a process crash after GitHub succeeds
   but before the receipt is committed without creating another PR. It may write
   only `editorial/quip/inbox/device-<64 hex>.json` on
   `staging/quip-device-<32 hex>`, never commit or merge into main. A received
   submission stays pending; `accepted` requires a human-reviewed, validated,
   merged editorial change. A merged intake PR alone is not acceptance.

After deployment, set the HTTPS API base URL in the PWA meta tag and bump the
PWA resource/cache version. Browser tokens and user-editable arbitrary endpoints
must not be added. Live acceptance needs an owner login, a real Draft PR, a
retry with the identical key proving a single PR, and a successful return after
an offline interval. Those live checks have not been run here.

## HTTP contract

All JSON responses carry `version: 1`. Requests use credentials cookies.

| Request | Result |
| --- | --- |
| GET `/auth/github/start` | OAuth redirect; state bound to session, return to PWA |
| GET `/session` | `{version:1, owner:true, csrf:<random token>}` after permission check |
| POST `/submissions` | Header `X-CSRF-Token`, `Idempotency-Key`; body `{version:1,key,card,classification}` |
| GET `/submissions/<submissionId>` | Owner-scoped verified editorial status |

Successful submission/status responses contain exactly the matching `key`,
`state` (`submitted`, `review`, `accepted`), opaque `submissionId`, and a verified
`https://github.com/Demian-rus/quantum-portal/pull/<number>` URL. Receipt creation
is not acceptance. 401/403 requires owner authentication; 409/422 is a content
error; 429/5xx/network failures retain the local queue. Failed client attempts
use exponential retry up to one hour; `online`, startup and the periodic visible
app check retry pending records. Manual retry is available when configured.

`card` is the strict quip-device@1 object from `device-dictionary.js`.
`classification` is the exact existing quip@1 classification (all eight modes,
Secret `actual-method`). `key` is SHA-256 of canonical card JSON, including stable
ID and revision. Edits produce a new version/key. The service validates with the
existing editor validator and compiler in memory; it stages a pending document,
not the temporary compiler probe and not generated production catalogs.

Local export/import never trusts remote statuses: imported cards are queued as
new unverified submissions. Removing a local card does not delete an already
created GitHub PR. Existing matches retain an exact immutable SHA-256 checked
snapshot independently of the store and its queue.
