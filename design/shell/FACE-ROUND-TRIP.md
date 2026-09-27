# The face round trip: browser to app-server process and back

Andy, 2026-09-27, in Desk under puppets/G10: *"so we all need to understand
and document what happens on browser to appserver-process post and return
path, using what we already have, wherever possible? anybody?"*

This page is that map: every step, the code that does it today, and what is
still owed. The reasoning and Andy's rulings behind each step are in
[PUBLIC-APP-SERVER.md, G17, *THE PATH*](PUBLIC-APP-SERVER.md). This page does
not repeat them. Citations are `path:line` at `7bce8d1`, and at `2223a36` for the route (G17, *THE ROUTE*, ruled 2026-09-27).

**The names are Andy's**, 2026-09-27, "go." on his proposal: *"ownerPost should maybe be called appServerPost() because that's the traditional webUI concept, the web programmer thinks of. And the return path would use appServerReply in the ownerNode"*. `appServerReply()` replaces the working name `puppyReply()`. `ownerPost.js` keeps its name: it is the other direction, the owner commanding a puppet. Reviewed by claude-windows; its additions (who forwards, the authority check, early answers, nested limits, patience) are folded in.

```
browser ─HTTPS─ Caddy ─HTTP─ puppetPost ─ appFaceApp ─packet─→ slot's node ─loopback─→ app-server process
                                              └─ (first time: asks its owner, the boot route, where the name lives)
browser ←────── Caddy ←───── puppetPost ← appFaceApp ←─reply, re=hash── appServerReply() ←── answer ──┘
                  (VPS puppet node)                          (the node that holds the name)
```

## Out: the browser's request

| # | Step | What does it today | Status |
|---|---|---|---|
| 1 | The browser asks `join.face.spirit.andyflinn.com`. DNS points `face.spirit.<domain>` and `*.face.spirit.<domain>` at the VPS; one Caddy block serves both, with the wildcard certificate by DNS challenge, and forwards plain HTTP on loopback, keeping the Host header. Caddy knows nothing about names. | Caddy and DNS, set by hand once (G17, *THE ROUTE*) | **owed**: the DNS records and the wildcard block. Open: which DNS provider holds the domain |
| 2 | **puppetPost** takes it: on only where `relay-state/face.json` names a port, loopback only, body capped at BODY_MAX. It hands the one claimed face `{host, method, path, body}` and nothing else. | `spirit/run/js/puppetPost.js:20` (face.json), `:45` `const FACE_BIND = '127.0.0.1';`, `:65` `function claim(appName, fn) {` | **built**, verified (d1bf284) |
| 3 | **appFaceApp** claims the face and turns the host into a name with the face domain, the owner node's setting (default `face.spirit.<relay domain>`). The bare face domain is no name, and a host outside it is none. | nothing calls `api.face(` yet (the hook is `spirit/run/js/nodeApps.js:391`); `faceRoute.nameOf` is declared in `spirit/test/faceRoutePending.js:40` | **owed** |
| 4 | **The route.** A cached route for the name is used. Otherwise the puppet asks its **boot route**, its owner (the key in `relay-state/puppet.json`). The owner answers from its grant rows: **mine**, or `{ name, to: <key>, until }` (*"like an HTTP redirect"*), or **no such route** by name. Each answer is a reply signed by the owner's key and carrying the question's hash. The puppet takes it only so, keeps a route until its `until` (an hour) or until its target refuses, and keeps a "no such route" a minute. RAM only: after a restart it asks again. | `faceRoute.answerRoute` and `faceRoute.createRouteCache`, declared in `faceRoutePending.js:46` and `:52`; the signed-reply rule is ownerPost's (`spirit/run/js/ownerPost.js`) | **owed** |
| 5 | **appServerPost()**: appFaceApp posts the visitor's request as an ordinary `peerPost` to the key the route named: the owner for **mine**, otherwise the slot owner directly, carrying the owner's signed route. It posts with a patience (`api.post` takes `{ patienceMs }`), and if the scheduler refuses or gives up, puppetPost answers 429 by name. It keeps the packet's hash with the open browser request, with a time limit. | `api.post` exists (`nodeApps.js`); the reply marker `re` exists (`spirit/run/js/client/packet.js:15`) | **owed**: the post, the waiting table and its limit |

## Across: the node that holds the slot

| # | Step | What does it today | Status |
|---|---|---|---|
| 6 | A **booted node app** on that node witnesses the packet, since *"nothing in node and relay should know about apps"*. It accepts it ONLY from its own puppet (for **mine**), or with the owner's signed route naming this node. That check is why the step exists: without it any node could drive an app process by posting. It then hands the app portion to its app-server process: a file by name, or a body to its door. | the app-server process listens on loopback: `spirit/run/js/appServer.js:1396` `server.listen(port, '127.0.0.1', function () {` | **owed**: the forwarding half and its check. The pipe instead of a port is G18 |
| 7 | The app-server process answers. On the first request it serves the page, and later posts go to its one door. | `appServer.js:1031` `if (pathname === '/' \|\| pathname === '/index.html') return own(appName + '.html');` | **built**: the answer is the HTTP response of the process's own door, which the forwarder reads directly. (`appServer.js:842`, which drops a body, is NOT on this path: it is `reachOwner`, the app server posting OUT to its owner.) |
| 8 | **appServerReply()** turns that answer into a reply packet whose `re` is the carried packet's hash, and posts it back to the request's sender, the puppet, whose key every arriving packet carries. | the same two-packet pattern as the grant: `spirit/run/app/appFaceApp/appFaceApp.js:162`; declared in `faceRoutePending.js:58` | **owed** |


## Back: the answer to the browser

| # | Step | What does it today | Status |
|---|---|---|---|
| 9 | The reply arrives at the VPS puppet node like any packet. The node's own listeners are witnesses and do not take it. | `spirit/run/js/arrivals.js` `witness` (bf593de); the replay reads every untaken row (dab9fec) | **built**, verified live |
| 10 | appFaceApp matches `re` against its waiting table. A match is that visitor's answer. No match is refused, and an entry past its time limit is answered 504 by name. | the matching rule is the one ownerPost uses for commands: reply taken only from the one it was sent to, once (`spirit/run/js/ownerPost.js`, tested in `spirit/test/ownerPost.js`) | **owed** in appFaceApp, with ownerPost's EARLY-ANSWER store too (a207e8c): a reply that lands before its wait is registered must be kept, or a fast owner loses answers |
| 11 | puppetPost writes `{status, type, body}` back to Caddy, and Caddy to the browser. Over the cap it is 502 `face-answer-too-large`, never a page cut off partway. | `puppetPost.js` (ae4ea50 for the cap) | **built**, verified |

**The time limits nest.** appFaceApp's waiting limit (step 10) must be SHORTER than puppetPost's `FACE_WAIT_MS` (30 s), so a visitor whose answer never comes gets appFaceApp's named 504 rather than puppetPost's generic one.

## What this adds up to

**Built and verified (steps 2, 7, 9 and 11):**
- the VPS entry point, loopback only;
- the app process's page and door;
- a node that keeps arrivals for whoever reads them;
- the named, capped answer to the browser.

**Owed, all of it G17's remaining slices (G10 builds on them):**
- **by hand, once:** the DNS records and the one wildcard Caddy block (step 1);
- **appFaceApp on the VPS:**
  - claim the face and turn a host into a name (step 3);
  - the route cache and its question to the boot route (step 4);
  - `appServerPost()` with its waiting table and time limit (steps 5 and 10);
- **the owner node:** answer the route from its grant rows, signed (step 4);
- **the node that holds the slot:** the forwarding half and its check (step 6), and `appServerReply()` (step 8).

**Reused rather than invented:**
- `peerPost` for every hop;
- `re` as the only link between a request and its answer;
- the signed two-packet grant exchange as the whole negotiation of a name;
- ownerPost's rule that a reply counts only signed by the right key and matching its hash, used for route answers too.

**Open**, from G17: which DNS provider holds the domain; what answers the
bare `face.spirit.<domain>`; whether the grant table's keeper keeps the
name appFaceApp.
