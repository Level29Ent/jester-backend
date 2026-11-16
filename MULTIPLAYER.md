# Compatible Jester Rush multiplayer

`npm start` now starts the shared, server-authoritative **20-course** runtime in
`runtime/`, not the legacy three-track prototype. Node.js 22+ is required. One
persistent Node process owns rooms; do not deploy this as one function per request
or scale across independent replicas without implementing shared room ownership.

## Deployment configuration

Configure the backend process with:

- `SUPABASE_URL`: the existing identity project's HTTPS Supabase URL.
- `SUPABASE_PUBLISHABLE_KEY`: that project's publishable key, **not** a service-role
  key. The server verifies user sessions via Supabase Auth; no `player_profiles`
  row or profile-provisioning migration is required to race.
- `ALLOWED_ORIGINS`: comma-separated **exact** game origins. Include every actual
  game hostname that must connect. No wildcard CORS and no cookies are needed.
- `PORT`: supplied by the existing hosting platform (defaults to 8080).

After deploying the backend, configure `JESTER_RACE_SERVER_URL` in the frontend's
build/runtime environment to its public HTTPS origin (no path/query/credentials),
then rebuild/redeploy the frontend. Configure that frontend's existing Supabase
email sign-in too. On Vercel, public config is served by functions; static hosts
use the build's public-only `online-config.json` fallback. Native config is not
implicitly enabled. Configuration does not deploy either repository automatically.

The backend health endpoint `/api/health` reports its protocol, geometry
fingerprint, course IDs, race deadline, and `rewards:false`. The frontend will not
enable online controls until it verifies compatibility. Matching only `ok:true`
is not sufficient. CORS must allow the frontend's actual Origin for health and
race requests. Authentication is needed for joining, listings and all race actions.

## Behavior

- Public matchmaking groups waiting real players and auto-starts at two. Client
  random course picks do not split the queue.
- Private rooms have 8-character codes, max 12 humans, host-controlled start and
  rematch, and host transfer when someone leaves. No bot fill, paid perks or
  editable-client upgrade claims are accepted.
- The server owns movement, collisions, checkpoints, falls, coins and finish
  ranks using the same course catalog and physics as the frontend.
- A finisher sees their results while others continue. Rematch waits for all
  racers or the 60-second deadline. Every rematch resets state and picks another
  course for all remaining clients.
- Each request requires a valid bearer identity and a room token owned by that
  identity. Validated identity is cached at most 15 seconds (never beyond token
  expiry) to avoid calling the auth provider for every 20Hz input poll.
- Old input expires after 300ms; inactive sessions expire after 30 seconds. A
  signed-in account can rejoin its existing room after reload; the old room
  session is invalidated. Room state does not survive process restarts.
- **Online coins are race score only and are not saved or paid out.** Existing
  database balances are not modified. The previous in-memory settlement queue
  was not restart-safe; this entry does not claim durable payouts. A durable,
  separately tested settlement service is needed before enabling online rewards.

## Source and checks

`runtime/SOURCE.json` records upstream commit and SHA-256 per file. Update it by
running `node scripts/export-multiplayer.mjs <empty-directory>` in the game repo,
then copying that output into `runtime/`. Do not hand-edit shared physics here.

`npm test` runs current multiplayer HTTP/two-client race/rematch tests, exported
snapshot hash checks, startup/health checks, and retained legacy engine tests.
The integration tests inject test identities; they do not prove real email
verification, production CORS, or live cross-device play. Before announcing live
multiplayer, test two distinct signed-in accounts on the deployed game through
create/join/countdown/finish/rematch/leave/rejoin, and confirm solo saves unchanged.
