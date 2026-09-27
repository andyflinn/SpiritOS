# The face round trip: browser to app-server process and back

Andy, 2026-09-27, in Desk under puppets/G10: *"so we all need to understand
and document what happens on browser to appserver-process post and return
path, using what we already have, wherever possible? anybody?"*

This page is that map: every step, the code that does it today, and what is
still owed. The reasoning and Andy's rulings behind each step are in
[PUBLIC-APP-SERVER.md, G17, *THE PATH*](PUBLIC-APP-SERVER.md). This page does
not repeat them. Citations are `path:line` at `7bce8d1`. Reviewed by claude-windows; its additions (who forwards, the authority check, early answers, nested limits, patience) are folded in.

```
browser ─HTTPS─ Caddy ─HTTP─ puppetPost ─ appFaceApp ─packet─→ owner node ─loopback─→ app-server process
browser ←────── Caddy ←───── puppetPost ← appFaceApp ←─reply, re=hash── puppyReply() ←── answer ──┘
                  (VPS puppet node)                          (owner's box)
```

## Out: the browser's request

| # | Step | What does it today | Status |
|---|---|---|---|
| 1 | The browser asks `join.spirit.andyflinn.com`. Caddy ends the TLS and forwards plain HTTP on loopback. | Caddy, on the VPS | exists, outside the tree |
| 2 | **puppetPost** takes it: on only where `relay-state/face.json` names a port, loopback only, body capped at BODY_MAX. It hands the one claimed face `{host, method, path, body}` and nothing else. | `spirit/run/js/puppetPost.js:20` (face.json), `:45` `const FACE_BIND = '127.0.0.1';`, `:65` `function claim(appName, fn) {` | **built**, verified (d1bf284) |
| 3 | **appFaceApp** claims the face and looks the host up in the routing table the owner granted (a subdomain is registered by the existing grant exchange). | grants: `spirit/run/app/appFaceApp/appFaceApp.js:109` `function decide(api, name, asker) {`; claiming: nothing calls `api.face(` yet (the hook is `spirit/run/js/nodeApps.js:391`) | **owed**: the claim, and the table lookup by host |
| 4 | appFaceApp posts the request to the owner as an ordinary `peerPost`, signing for the route (never for the person), and keeps the packet's hash with the open browser request, with a time limit. It posts WITH a patience, so a busy owner node does not bounce a visitor: `api.post` is the node's own router and takes `{ patienceMs }` directly, with no verb change. If the scheduler refuses or gives up, puppetPost answers 429 by name. | `api.post` exists (`nodeApps.js`); the reply marker `re` exists (`spirit/run/js/client/packet.js:15`) | **owed**: the waiting table, its time limit, and the patience |

## Across: the owner's box

| # | Step | What does it today | Status |
|---|---|---|---|
| 5 | A **booted node app on the owner's node**, appFaceApp's counterpart, witnesses the packet. It is not node core, since *"nothing in node and relay should know about apps"*. It accepts it ONLY if it comes from the owner's own puppet's key AND names a host the grant table routes to one of the owner's apps. That check is why the step exists: without it any node could drive the owner's app process by posting. It then hands the app portion to the app-server process: a file by name, or a body to its door. | the app-server process listens on loopback: `spirit/run/js/appServer.js:1396` `server.listen(port, '127.0.0.1', function () {` | **owed**: the forwarding app, and its two-part check. The pipe instead of a port is G18. |
| 6 | The app-server process answers. On the first request it serves the page, and later posts go to its one door. | `appServer.js:1031` `if (pathname === '/' \|\| pathname === '/index.html') return own(appName + '.html');` | **built**: the answer is the HTTP response of the process's own door, which the forwarder reads directly. (`appServer.js:842`, which drops a body, is NOT on this path: it is `reachOwner`, the app server posting OUT to its owner over the relay. G17's section says so too.) |
| 7 | **puppyReply()** turns that answer into a reply packet whose `re` is the carried packet's hash, and posts it back. It is a named function, not a new wire verb. | the same two-packet pattern as the grant: `appFaceApp.js:162` `const made = packet.encode(APP, Object.assign({ verb: 'granted' }, answer), { re: message.hash });` | **owed** |

## Back: the answer to the browser

| # | Step | What does it today | Status |
|---|---|---|---|
| 8 | The reply arrives at the VPS puppet node like any packet. The node's own listeners are witnesses and do not take it. | `spirit/run/js/arrivals.js` `witness` (bf593de); the replay reads every untaken row (dab9fec) | **built**, verified live |
| 9 | appFaceApp matches `re` against its waiting table. A match is that visitor's answer. No match is refused, and an entry past its time limit is answered 504 by name. | the matching rule is the one ownerPost uses for commands: reply taken only from the one it was sent to, once (`spirit/run/js/ownerPost.js`, tested in `spirit/test/ownerPost.js`) | **owed** in appFaceApp, with ownerPost's EARLY-ANSWER store too (a207e8c): a reply that lands before its wait is registered must be kept, or a fast owner loses answers |
| 10 | puppetPost writes `{status, type, body}` back to Caddy, and Caddy to the browser. Over the cap it is 502 `face-answer-too-large`, never a page cut off partway. | `puppetPost.js` (ae4ea50 for the cap) | **built**, verified |

**The time limits nest.** appFaceApp's waiting limit (step 9) must be SHORTER than puppetPost's `FACE_WAIT_MS` (30 s), so a visitor whose answer never comes gets appFaceApp's named 504 rather than puppetPost's generic one.

## What this adds up to

**Built and verified (steps 2, 8 and 10):**
- the VPS entry point, loopback only;
- a node that keeps arrivals for whoever reads them;
- the named, capped answer to the browser.

**Owed (steps 3, 4, 5, 7 and 9), and all of it is G17's remaining slices; G10 builds on them:**
- **appFaceApp:** claim the face, look up the route, post, and keep a waiting table with a time limit;
- **the owner's box:** a booted forwarding app, accepting only its own puppet's key and a granted host;
- **puppyReply():** the reply carrying the request's hash.

**Reused rather than invented:**
- `peerPost` for both directions;
- `re` as the only link between a request and its answer;
- the grant exchange for route rows;
- ownerPost's rule that a reply counts only from the node it was sent to, and only once.

**Open:** nothing new. Every step above is either built or decided in
PUBLIC-APP-SERVER.md G17.
