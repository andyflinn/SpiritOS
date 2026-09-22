# The proxy — `net.fetch`, and the keys it carries

**Design sitting, opened 2026-09-22.** No patch until Andy rules.

> **Andy, 2026-09-22:** *"and please note that a design session for the
> proxy system must come soon."* — *"on our side lets get the the proxy api
> design happening."* — *"a instrinisc app will maintain the allow list
> associated with that part of SpiritOS services."*

## Vision

The node is where Andy's secrets live. Anything on the box that needs an
outside service — an app, a spawned script, an agent's review — asks the
node, names the key it needs, and never holds it. The node decides whether
that key may go to that host, in that way, and says what it cost — knowing
keys, never apps (*"on the core-layer apps are unknown"*). Andy keeps the
rules in an app, not in code.

## What the tree does today — verified at `a83f219`

1. **One verb, for everyone on the loopback door.** `net.fetch` is
   `handleGenericProxy` (`spirit/run/js/server.js:479`). The door's only gate
   is loopback + Host (`server.js:559`). The shell hands every app
   `fetchExternal` (`spirit/run/js/client/shell.js:1239`), a spawned script
   posts to it directly (`process/js/grokReview/grokReview.js`, `nodeFetch`).
2. **Any asker may name any listed key.** `${ENV:NAME}` is filled in by
   name, host and — new today — method (`spirit/run/js/envSecrets.js`,
   `ALLOWLIST`). Nothing ties a key to an asker: `app/aiChat/aiChat.js:311`
   and `app/aiManager/aiManager.js:38` name the Anthropic key; any other app
   could name the Grok key and spend Andy's budget at `api.x.ai`.
3. **It waits at most five minutes, whatever it is told.** The caller's
   `timeoutMs` arms an abort (`server.js:488`), but the call is Node's own
   `fetch` (`server.js:502`), whose default headers timeout is 300 s. The
   first Grok review, at high reasoning, was sent 13:03:56 and dropped
   13:08:59 as *"proxy target unreachable"* — Grok still thinking. Not
   billed (balance unchanged).
4. **It carries at most ~17 KB out.** Every `/api/spirit` body is refused
   over `BODY_MAX` = 17,408 (`limits.js:116`, via `serveCommon.js:225`) — a
   bound set for peer packets (`PAYLOAD_MAX` 16,384, `limits.js:70`) that the
   proxy inherits by sharing the door. The answer coming back is unbounded
   and buffered whole (`server.js:502`–`507`).
5. **Nothing counts what a call cost.** `grokReview` reads
   `usage.cost_in_usd_ticks` itself; `aiChat` does not; the node keeps no
   record of paid calls.

## The questions, for Andy

Each with a recommendation; none decided.

1. **Who may use which key?** ~~*Recommended:* a key is granted to an asker —
   an app by name, or a script by its folder — and the node refuses a key
   the asker was not granted.~~ **Corrected the same day by Andy:** *"on the
   core-layer apps are unknown."* The node cannot grant a key to "aiChat":
   it knows keys, hosts and methods, and nothing at its loopback door says
   who is asking (`server.js:559` checks only that the caller is on this
   box). The rule is standing — `relay.js` records it as *"nothing in node
   and relay should know about apps"*. **So the question becomes:** is
   scoping a key by host and method enough at the core, with *who* may ask
   left to the layer that knows apps (the shell, and the intrinsic app) —
   or does the core need an asker it CAN know, such as a credential the
   owner hands out, which names no app?
2. **Where do the rules live?** *Decided in principle (Andy):* an intrinsic
   app keeps the allowlist. *Recommended:* the same app keeps the grants
   (question 1, in whatever form it takes) and shows the spend (question 5), stored in `node.db`, which
   the node already owns (0021). A new persist shape — so this is the
   review's, not a patch's.
3. **How long may a call wait?** *Recommended:* the asker says, up to a
   ceiling the owner sets per key (a reasoning model needs ten minutes; a
   chat needs one), and the node's own waiting honours it — which means
   lifting Node's five-minute default for that call.
4. **How big may a call be?** *Recommended:* the proxy gets its own bounds,
   separate from peer packets — out and back — so a review is not held to a
   packet's size and a runaway answer cannot fill the node's memory.
5. **What does Andy see of the cost?** *Recommended:* where a service
   reports a call's cost, the node records it against the key (and against
   an asker only if question 1 gives the core one it can know); the app
   shows it. Where a service does not, the node counts calls
   and says the cost is unknown — never guesses.

## Decided already, and not reopened here

- The node holds the keys; askers name them (Andy: *"this is where the
  env-variable proxy-call in node should come in"*).
- A paid review runs only on a cap Andy grants in words
  (`design/agents/GROK-REVIEWS.md`).
- Andy's vault never goes to an outside service (`AGENT.md`).

## Open

- Whether a browser app should be able to use a paid key at all, or only
  with Andy present.
- Streaming answers back (a long reply seen as it arrives) — useful to chat,
  not needed for a review.
