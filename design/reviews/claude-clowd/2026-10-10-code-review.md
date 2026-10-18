SpiritOS code review
Oct 10, 2026 · @Andreas Thut
Verdict
SpiritOS is carefully reasoned at the protocol level, and its sealing and request signing hold up. The weak points are at the edges: one critical path from the node's own outbound fetch to running any command, a one-request crash reachable from any website, reply content that a relay can rewrite, and several places where a relay counts or trusts a claimed identity before checking its signature.
Fix these five first:
1. Stop net.fetch reaching loopback and private addresses, and restrict jobs.create to included scripts (C1). Today one fetch turns into a root shell, and the local model can make that fetch.
2. Reject NUL bytes in request paths and catch the sendFile throw (H1). One iframe on any website kills the node.
3. Sign the reply text, not just the hash (H3). Any relay on the path can rewrite a peer's answer.
4. Verify signatures before counting rate limits or writing monitor events on the relay (H2). A stranger can silence any member for a minute at a time.
5. Only accept published objects from the module's own server (H4). Any contact can forge chat lines and press-ready grant checks in Desk.
How this was done. I reviewed commit e8f8ffd (2026-10-10), about 61,000 lines of JavaScript plus the bash, install and platform scripts, split into seven areas. Every finding below was checked against the exact lines. Most were also reproduced on a scratch copy; the confidence column says which. I personally re-ran the NUL-byte crash and the fresh-clone failure. Nothing in the repository was changed.
Severity is judged against the system's own trust model (one operator, loopback node, public relay). Several items are known deferrals in AGENT.md or CLAUDE.md (for example X-Forwarded-For); they are marked so you can decide whether the deferral still holds.
Critical and high
Ten findings, one critical. Paths are under spirit/run/ unless they start elsewhere.
ID
Severity
Finding
Where
What goes wrong
Fix
Confidence
C1
Critical
net.fetch can reach the node's own door, so one fetch runs any command as the node's user
js/server.js:585-654, js/proxyList.js:50, 227-244, js/jobs.js:416-432, process/js/deskAgent/deskAgent.js:241
The proxy list defaults to open and only checks secret keys, never the address. A net.fetch to http://127.0.0.1:65432/api/spirit with jobs.create {command:"/bin/sh", args:["-c",...]} spawns it; refuseUnlisted only inspects args[0]. net is offered to the local model as a tool, so model output or content it reads can drive this
Refuse loopback, link-local, RFC1918 and metadata targets in handleGenericProxy unless a proxy entry opens that host. Separately, make jobs.create accept only process.execPath with an included process/js script
Reproduced (file written as root)
H1
High
A NUL byte in the path crashes the node, and any website can send it
js/serveCommon.js:82, 260-271, js/server.js:720-731, 864
<iframe src="http://localhost:65432/x%00"> passes the cross-site check as a navigation; fs.readFile throws synchronously with nothing to catch it; the process and its child jobs exit
In parseRequestPath return 400 when the path contains \0; wrap the readFile call in sendFile
Reproduced by me
H2
High
Relay counts posts against the claimed sender before checking the signature
js/relay.js:4020-4036 (signature checked later at 4062, 4142, and not at all on the no-such-peer path 4126)
600 junk posts a minute with from=<victim> and a fake sig use up the victim's budget; their real posts get 429. Works against partner relays too, and logs the victim as the sender in the monitor
Verify first, then count. If junk must be throttled before crypto, use a separate bucket not keyed on the claimed identity
Reproduced
H3
High
Reply content is not authenticated; any relay on the path can rewrite a peer's answer
js/relayAuth.js:177-189, js/peerPost.js:390-396, 1563-1625, js/seal.js (AAD is label/from/to only)
The receipt signs only hash + minute. A relay keeps the real receipt and swaps the text, or seals new text to the asker's public seal key. The asker gets ok:true with the forged text. Contradicts the comment at relay.js:4295
Sign receipt + hash + minute + sha256(text) and verify it on both relay and node; put the request hash in the reply seal's AAD
Reproduced
H4
High
Any contact can forge "own server" state in Chatter, Desk, DeskDetails and RuleDetails
js/client/shell.js:1983-1995, 2206-2209; shell/chatter/chatter.js:347, shell/desk/desk.js:516-563, shell/deskDetails/deskDetails.js:361-379, 467-477
A packet with app:'published' and module:'process/js/desk' is handed to the app's onPublished handler with only meta.from beside it, and those apps ignore from. A contact can insert chat lines "from Bob", freeze Desk with change: 9e15, or show a check labelled harmless that grants a real pending core-file grant when pressed
Accept a streamed published object only from a key on a per-module puppet allowlist, or deliver remote objects on a separate onStreamed channel
Read end to end
H5
High
Core shell files can be overwritten through fs.save and fs.delete
js/kernel.js:227, 271, 286, 334-344; js/coreFiles.js
fileWritable protects only shell/<x>/<x>.js and .json. shell/js/*.js (loaded on every boot), shell/tokens.css, shell/shared/ask.js are writable. Breaks the README promise
Refuse writes where coreFiles.isCore(...) is true
Reproduced
H6
High on Windows and macOS
Path gates are case-sensitive string matches
js/kernel.js:271, 286, 334-366
fileServable('Relay-State/identity.json') is true, so on NTFS or APFS GET /Relay-State/identity.json serves the node's private keys. natter.JS, natter.json. and ::$DATA variants pass fileWritable
Lower-case before comparing on win32/darwin (or compare real paths), and reject : and segments ending in . or space
Gate logic reproduced on Linux; OS behaviour documented
H7
High
A fresh clone cannot start
js/server.js:90-108
npm start writes relay-state/environment.json before the folder exists: ENOENT. The read above it is dead code too (env.PORT on an undefined env, swallowed)
mkdirSync(dirname, {recursive:true}) before the write; fix or delete the read
Reproduced by me
H8
High
One torn write wipes the whole contact book, blocks included
js/contacts.js:172-186
save writes in place; load turns any parse error into []. After a crash mid-write, the next inbound message saves a book with one row, unblocks everyone and drops eviction marks
Write temp, fsync, rename; treat a corrupt file as an error and set it aside, never save over it
Reproduced
H9
High
A long search query stalls the relay's event loop for seconds
the old graded search (deleted in goal/G29.22); js/relay.js:3352
No cap on q. 1,000 rows against "a ".repeat(1000) took 7.3 s, 8,000 chars took 30.5 s; partners get the same query
Cap the query (about 128 bytes, 8 tokens) where the search opens; compute matchTokens once per row
Measured
Medium
Thirty-one findings, grouped by area. "Reproduced" means a scratch script showed it; the rest were confirmed by reading.
ID
Area
Finding
Where
Fix
M1
Relay
A signed post can be replayed once it has been answered: the same invite post minted two tokens; config restart:true can be replayed for about 2 minutes. Reproduced
js/relayAuth.js:126-146, js/router.js (hash dropped on answer or after 5 s), js/relay.js:4079
Keep a seen-hash set that outlives the ±1 minute signature window; same for stream signatures
M2
Relay
Claim rate limit is one bucket for the whole internet behind Caddy: 10 junk claims a minute block every real claim, including the owner's. Known deferral ("No X-Forwarded-For unless asked")
bash/caddy/Caddyfile, js/serveCommon.js:200-202, js/relay.js:144, 1557
Trust the last X-Forwarded-For hop only when the socket is loopback, or key the limit on the verified public key plus a small global cap
M3
Relay
Relay binds 0.0.0.0, while docs say 127.0.0.1; without ufw, plain HTTP on 65430 is public
js/relayServer.js:917, bash/README.md:36, bash/RELAY-HOST.md:57
Bind loopback by default under the Caddy layout, with a --bind flag
M4
Relay
Removing a member does not end their stream; heartbeats keep it alive forever. Reproduced
js/relay.js:2553-2555, js/presence.js disconnect
Close the sink in forgetPeer (or in disconnect(id, null))
M5
Relay
One member can keep any other member "busy": one in-flight slot per target, held 5 s, and nodes never answer strangers. Reproduced (503 for the owner)
js/router.js:65, 146, js/relay.js:4211
Count the per-target slot per requester, or allow a few slots with fairness
M6
Relay
Two identical device offers in one minute leave the first HTTP request hanging forever. Reproduced
js/relay.js:2264-2318
Return the existing promise when awaitingReply[hash] exists
M7
Comms
Retries and restored queue entries resend the original signature, which the relay rejects after about 2 minutes, so long-patience posts and the durable queue fail as "refused". Reproduced
js/peerPost.js:556, 998-1007, 1650-1658
Re-sign each attempt and track the intent by a local id
M8
Comms
A late POST response is applied to the current retry: frees the per-relay slot early or doubles backoff twice. Reproduced
js/peerPost.js:509-624
Capture the attempt number and ignore stale responses
M9
Comms
Two identical unsealed posts in one minute (card asks) overwrite waiting[hash]; the first never resolves. Reproduced
js/peerPost.js:965-981
Return the existing promise or refuse with 409
M10
Comms
SSE client buffer has no cap and is re-split on every chunk: 146 MB heap after 24 MB without a blank line. Reproduced
js/sseClient.js:298-302
Cap the buffer and reconnect; search only the new tail
M11
Comms
relayRequest has no timeout, no size cap, no response error handler, and splits UTF-8 across chunks. Reproduced
js/relayRequest.js:67-85
Collect Buffers, Buffer.concat once, add setTimeout, handle aborted/error, cap bytes
M12
Comms
Re-claiming at a relay you were seated at skips the pinned key and seals the invite to whatever key answers
js/hub.js:1078-1080, 276-317
Compare against relayKeys.pinned(url) and refuse on mismatch
M13
Comms
Every delivered message's plaintext is kept in memory forever (arrived[])
js/peerPost.js:234, 1356, 1681
Delete it (the traffic log is the record) or make it a small ring
M14
Node
The loopback API has no credential, so any local process or OS user is the owner, and jobs.create runs any command. Reproduced
js/server.js:735, 1829, js/jobs.js:416-432
Per-boot secret in relay-state/ (mode 0600), given to the shell and children, required on /api/spirit
M15
Node
proxy.allow sits on the same door as net.fetch, so any app can allowlist an attacker host for ANTHROPIC_API_KEY; secrets are also substituted into http:// URLs. Reproduced
js/server.js:585-619, 1784, js/envSecrets.js:44-69
Substitute only for https:; make the proxy list owner-edited only
M16
Node
Oversized /api/spirit body (about 700 MB) crashes the node with RangeError: Invalid string length. Reproduced
js/server.js:215-216, js/serveCommon.js:164-174
Hard cap even for net.fetch; collect Buffers; catch in the listener
M17
Node
Labels outside Latin-1 break every app-server call (ERR_INVALID_CHAR in a header, reported as app-not-running); "José" arrives garbled. Reproduced
js/appClient.js:117-123, js/relayRequest.js:120-126
encodeURIComponent the label header and decode in appServer
M18
Node
fileServer.chunk calls Buffer.alloc(length) with any peer-supplied length
process/js/fileServer/fileServer.js:103-114
Clamp to CHUNK (6000)
M19
Node
fileServer push, fill and pull take raw absolute paths: copy ~/.ssh/id_ed25519 into the pool, then grant it to a peer
process/js/fileServer/fileServer.js:260, 291, 342-348
Resolve through kernel fsPath and the servable/writable gates, or limit to media/
M20
Shell
The shell can be framed by any site (no X-Frame-Options or frame-ancestors), so two-press controls like Rotate key and Grant can be clickjacked
js/server.js:720-729
Send X-Frame-Options: DENY and frame-ancestors 'none'; require sec-fetch-dest: document for navigations
M21
Shell
Contact-label rename listeners and contactSelector document click handlers are never released; grows on every keystroke and render
shell/js/contactLabel.js:126-140, shell/js/contactSelector.js:135-160, 202, shell/natterDetails/natterDetails.js:1110-1117
Drop listeners when !root.isConnected; add the click listener only while open, as iconSelector.js does
M22
Shell
Any contact can append unlimited agents packets to Desk's persistent log, each with a full redraw and backup
shell/desk/desk.js:72-97, 172-185, 1404
Accept only from known agent keys
M23
Data
Replay index and relay record are never trimmed in production; sweep and coarsen have only test callers
js/nodeStore.js:1000-1003, 1192-1201
Call both from the node's periodic tick
M24
Jobs
Job log lines have no length cap; one long line is held, stored and streamed to every page
js/jobs.js:61-66, 248-254
Cap each line and the total log bytes
M25
Jobs
The local model's tool list is "any verb with a description file", run as the owner
process/js/deskAgent/tools.js:95-157, deskAgent.js:241-318
Keep an explicit allowlist of model-callable verbs
M26
Ops
A SPIRIT_TRACK=master left in the shell bypasses the tag-only release gate on the live relay
bash/lib.sh:29-34, 91, bash/update:33-37, 111-113
Unset every SPIRIT_* before sourcing .env
M27
Ops
install/kamerata/update.sh deploys origin/master to production with no tag gate, no check and no rollback, and comments still call it how the relay updates
install/kamerata/update.sh:1-6, .gitignore:151
Delete it or make it exec bash/update; check spirit-3's crontab
M28
Ops
bash/update has no rollback, a single 3-second health check and no lock; a bad tag leaves the relay down and cron says "already at"
bash/update:111-150, bash/lib.sh:166-176
Reset to the previous commit on failure; flock; timeout on fetch
M29
Ops
A rejected Caddy site file is left in sites/, so the next reload or reboot takes every site down
bash/tls:37-39, 63-65, bash/face-tls:34-46, 80-82
Validate a temp file, then mv it in
M30
Ops
face-install captures stderr into the invite, so the Node 22 SQLite warning corrupts it. Reproduced
bash/face-install:174-181
2>/dev/null or node --no-warnings; build the JSON with node -e
M31
Ops
An sk- API key for the local Unsloth endpoint is committed, and ships in the install zips
process/js/deskAgent/connection.json
Rotate it, git rm, ignore **/connection.json
Also medium, ops: systemd units run as root with only NoNewPrivileges and PrivateTmp (bash/systemd/*.service; add ProtectSystem=strict, ReadWritePaths, empty CapabilityBoundingSet); the Windows backup skips every subfolder of relay-state, including desk.db (install/backup-windows/backup.js:67-70); start.ps1 downloads node.exe from latest-v22.x with no hash check; bash/firewall never sets default-deny and assumes SSH on 22.
Low
Worth fixing when you are in the file anyway.
• Relay body reader splits UTF-8. js/serveCommon.js:168-177 does body += chunk on Buffers, so "café" split by TCP arrives as "caf��"; the unsealed device password is the visible victim. Reproduced.
• Keys accepted in many spellings. js/relayAuth.js:344-375 decodes base64 leniently, so one keypair can hold several member rows (each still costs an invite). Apply the existing OWNER_KEY regex (relayAuth.js:389) wherever a key enters from the wire.
• Claim signature names no relay and no time. relayAuth.js:43 signs 'claim\n'+name, so relay A's operator can reuse Bob's claim at relay B. Sign the relay key and minute too.
• Removing a member revokes unrelated invites whose label matches the member's self-chosen name (js/relay.js:2547).
• Unauthenticated requests re-read identity.json from disc up to five times per GET /api/relay/key (js/relayServer.js:639-665, relay.js:2628); load it once.
• No server timeouts or connection cap on the relay (js/relayServer.js:603); set requestTimeout, headersTimeout, maxConnections.
• Seal key cached before the pin check (js/answerRelay.js fetchKey); set sealOf[url] only after relayKeys.check passes.
• retry: 0 from a relay makes the SSE client reconnect with zero delay forever (js/sseClient.js:124, 214, 314): 854 attempts a second. Clamp it.
• SSE parser keeps \r from CRLF framing, so event: request\r\n matches nothing (js/sseClient.js:100).
• The too-late reply path lets any self-made key add rows to the permanent traffic log (js/peerPost.js:1564-1598), contrary to its comment.
• Owner command envelope ids are never remembered (js/puppetMode.js:105), so the replay promise in relayAuth.js:215 is not implemented.
• Symlinks are followed by both path gates (js/kernel.js:176-187); realpath the deepest existing ancestor.
• Non-atomic writes in kernel.js:371-380, deviceAuth.js, proxyList.js, and fixed-name .tmp files.
• coarsen() compares at alone, so two relays reporting in the same minute keep the wrong rows (js/nodeStore.js:577-582).
• record.put stores seats unfiltered (js/nodeStore.js:1060-1077), bypassing the "never keep people" sift. Latent.
• seen.put can move seen backwards (js/nodeStore.js:638-639); use MAX.
• Peer names can fake "blocked" state because the browser parses ' — blocked' off the label (shell/contacts/contacts.js:362-411, js/hub.js:416-424). Needs a wire change, so a team review.
• A failed app-script load leaves the launcher dead with no onerror (js/client/shell.js:1788, 1823-1838).
• Packet handlers are called without try/catch (js/client/shell.js:2201, 2221), so one app's throw stops delivery to others.
• Media names containing # or ? do not display (index.html:1642, encodeURI).
• device.html stores an extractable private key in sessionStorage and never uses it (device.html:230, 257).
• create-localEar.js generates a file that does not parse (use strict; unquoted). deskAgentEar.js already does its job; delete it.
• package.json is out of step: main points at install.js, which runs on load; licence says ISC but LICENSE is AGPL-3.0; glob is a dependency nothing requires.
• Stray files committed at the root: seven temp_loop*.js copies, a UTF-16 temp-desk-reply.js, .vscode/tasks.json.mine, conf/settings.json, and three JavaScript fragments pasted into .gitignore:239-241.
• Personal Google account path as a default in install/backup-windows/backup.js:43.
• bash/start reports "ok started" without check_started; units hardcode /usr/bin/node while install-units uses PATH.
Architecture and maintainability
Most findings come from six structural habits. Fixing the habit closes several findings at once.
1. The loopback door has one principal. The shell, every app, every child process and every local user are all "the owner", so fileWritable, the proxy list, ownerOnly and the include list defend against nobody local. A per-boot capability token, with owner-only verbs (jobs.create, proxy.allow, jobs.authGrant, fileServer.push) kept apart from app verbs, closes C1, M14, M15 and M19 together.
2. The relay authenticates last. Rate counting, row lookups, monitor events and seal opening happen before the signature check. One authenticate(from, sig, bytes) step at the top of each route makes the order structural (H2, M2, low items on identity re-reads).
3. Replay protection rides on routing state. The router forgets a hash once it is answered or after 5 s, but signatures live for about 3 minutes. Replay needs its own bounded store sized to the signature window (M1, owner command ids).
4. Remote and local events share one interface. onPublished, onPacket and onRegarding give remote and local objects the same shape and leave sender checks to each app; only one app does it (H4, M22). The shell should apply a sender policy per subscription.
5. Four path jails that share no code: kernel fsPath, the static route, fileServer's raw paths, and coreFiles.isCore, which nothing on the write path consults. One canonicaliser that knows case, links and Windows quirks closes H5, H6, M19 and the symlink item.
6. Waiter maps and transports are hand-rolled each time. waiting, awaitingReply, heldForPartner and carrying each have their own overwrite and timeout rules; relayRequest, sseClient and pipeRequest each have their own limits. A shared "register once, settle once, time out once" helper and one bounded-read helper remove M6, M8, M9, M10 and M11 as a class.
Comments now assert properties the code does not have. Examples: "a registered hash stops a post being replayed" (relayAuth.js:53), "if they are holding a stream, it ends now" (relay.js:2553), "neither relay can alter what was said" (relay.js:4295), "a stranger cannot write a row here" (peerPost.js), "DEFAULTS TO max" (router.js:57, the value is 1), and the URIError lab item in relayLab/open/, which is already fixed. Large files are mostly dated history and quotes: relay.js is 5,089 lines and peerPost.js about 70% comment. Reviewers trust comments, so a stale security claim is worse than none. Moving the history into design/decisions/ and keeping a one-line rationale in code would make defects easier to see.
Agent instructions are spread across eight root files (AGENT.md, ANDYS_RULES_FOR_AGENTS.md at 70 KB, CLAUDE.md and CLINE.md byte-identical, GROK.md, GPT-OSS.md, RULES.md, AGENT_ONBOARDING.md) plus .cursor/, .github/agents/ and agents/. One canonical file with short pointers would stop them drifting.
There are no tests against a hostile relay or peer. Every suite uses honest loopback relays, which is why H3, M8, M10 and the SSE items went unnoticed. A small fake-relay harness (forge a reply, send retry: 0, stream without blank lines) would cover them.
Test suite and what held up
The full run on a Linux cloud container ended with 362 suites, 5,034 green, 34 red, 23 unhappy, 6 awaiting, exit code 1. Some reds are this environment (four say fetch failed reaching a local node, and deskAgent needs a hand-written config), but the committed agents/*/harness.json records show red runs on all three of your own boxes too (8 on Linux, 19 on Windows, 21 on WSL at 3ce4152).
That means npm test cannot work as a gate today. Three changes would fix it: quarantine known reds so a clean run exits 0; stop runAll.js writing the tracked DONE.md on every run (spirit/test/runAll.js:412-476); and add a minimal GitHub Actions workflow for Linux, since .github/ holds no CI.
Checked and found sound:
• Sealing: fresh X25519 key per message, HKDF salt binding both keys, AES-256-GCM with random nonces.
• Request signing: the post signature covers the sealed bytes, from, to and the minute; the receiver checks to and refuses unsealed requests.
• SQL: every query is a prepared statement. No injection found.
• Prototype pollution: none found; lookup maps use Object.create(null).
• XSS: every HTML interpolation traced in the shell goes through escapeHtml; no eval, postMessage or document.write.
• Child processes: every spawn/execFile uses an argument array with no shell, including the git operations.
• Secrets: API keys come from the environment and are only substituted for hosts the proxy list opens (but see M15).
• TLS: no rejectUnauthorized: false anywhere.
• Browser CSRF: the Origin and Sec-Fetch-Site checks correctly refuse cross-site API calls (verified 403); only navigations get through, which is what H1 and M20 exploit.
• The old URIError on relay paths is fixed (js/serveCommon.js:260-271); relayLab/open/2026-09-06-urierror-on-relay-path.md can be closed.