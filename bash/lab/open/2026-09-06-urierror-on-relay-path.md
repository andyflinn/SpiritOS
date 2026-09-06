# Stop URIError on a bad percent-encoded path from killing --relay

- Status: open
- Dropped: 2026-09-06
- Box: laptop first, then spirit-3 via cron
- Files: `spirit/run/js/server.js` (likely `url.parse` / `decodeURIComponent` on `req.url`)

## Why

The boundary review: a request with a broken `%` sequence throws `URIError` uncaught and can take down the public Node process. Caddy will then 502 until systemd restarts it. That is a mailbox availability bug, not a bash bug.

## Do this

1. Find every `decodeURIComponent` / `new URL` on `req.url` in `server.js`.
2. Wrap path decode in try/catch; on failure reply **400** and keep the process up.
3. Add `server.on('uncaughtException')` only if you must — prefer catching at the request.
4. Add a test next to `spirit/test/` that `GET`s a path like `/%E0%A4%A` or `/%` against a temp `--relay` and expects 400, process still alive.
5. Commit on master. Cron on spirit-3 will pick it up.

## Done when

- `curl -s -o /dev/null -w '%{http_code}' https://spirit.andyflinn.com/%` is 400, not empty / 502.
- `./bash/status` still shows the unit active after that curl.
- A unit test exists and is the thing you trust, not only the live curl.

## Out of scope

Proxy key leak (personal node). `User=spirit`. HTML escaping (already landed).
