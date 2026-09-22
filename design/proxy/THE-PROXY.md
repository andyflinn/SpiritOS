# The proxy — `net.fetch`, and the keys it carries

**Design sitting, opened 2026-09-22; the core half built the same day** on
Andy's *"come on! ... that's the same trust i mentionned before."* The shell
half is deferred.

**Built:** `spirit/run/js/proxyList.js` — the owner's list in
`relay-state/proxy.json`, written from the old code list on first use, read
on every call, and a broken file closes the gate. `proxy.list`, `proxy.allow`,
`proxy.remove`, `proxy.close`, `proxy.open` (server.js) are the only way to
change it. `net.fetch` asks the gate first, fills keys only from open
entries, and calls out with `http`/`https.request`, which imposes no wait
— the caller's `timeoutMs` if given, otherwise none. **Verify:**
`spirit/test/proxyList.js` (defaults, allow/remove, the gate three ways, a
broken file) and `spirit/test/serverSurface.js` case 6 (on a real node: not
served, not writable through fs, close and open, a closed key, and an 11 s
far end answered). Falsified: gate removed, 10 s default put back.

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

### The environment it is for

> **Andy, 2026-09-22:** *"picture an environment where hppt is disallowd for
> agents, but node-access is."* — *"if i see outragous spending by agents,
> i then could close the node-gate."*

**A picture of other environments, not this box.** Andy: *"I'm not saying
that my agents here should ot do their own internet calls, that would slow
us down unneccessarily"* — here, agents keep their own internet. An agent
sandboxed to its node — no web calls of its own, only the loopback door —
would have **the proxy as its whole internet**. There:

- **The list is of websites, with a key only where one is needed** —
  reading GitHub or documentation needs none.
- **Trust becomes enforcement.** What bounds an agent's spending today is
  trust (below); behind the node it is the owner's list, because the agent
  has no other way out.
- **The owner holds the gate.** Closing it — the whole proxy, one key, or
  one website — stops every agent at once, on its next call, with a refusal
  that says the owner closed it, so an agent stops and reports instead of
  retrying.
- **Waiting and size matter** (questions 3 and 4): an agent doing real work
  through the node needs long waits and large answers.
- The sandbox itself is the agent host's, not SpiritOS's — the node cannot
  stop a process that has its own network. *(Recommended, unverified: an
  agent host that allows only loopback; to be checked before it is
  promised.)*

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

## The questions, for Andy — all five ruled 2026-09-22 (below)

Each as first written, with its recommendation; the rulings are in the sections that follow, and a struck line stays visible.

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

   **Decided 2026-09-22 — no pass.** Andy: *"my authoriy extends over the
   whole machine. it's implicit."* Whatever runs on the box runs with his
   authority, so a local asker needs nothing more to use a key. The only
   outsider at the door was a web page on another site, and that is closed
   (`deb5978`: a request naming another origin, or marked cross-site, is
   refused before any route — found by wsl-claude, verified on every team
   node). The core scopes a key by name, host and method, and knows no
   asker.
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

## Decided 2026-09-22 — the shape

> **Andy:** *"since spending may require completely different logic for
> every external api, that's out of scope for now. immediately concerning
> to me: a protocol where apps require specific api's/keys outside of
> SpiritOS or my box. so the proxy manager must allow the node-owner to
> simply grant access to the proxy api.... this is shell-scope, actually,
> and on the core-side it's primarily about having a configuration file for
> allowed key/website combinations and a client api (loopback) that allows
> that internal list to be maintained. that node-file will be
> !fileServable() ?"*

- **Question 5 is out of scope.** Each outside API reports (or does not
  report) cost its own way; no generic cost logic in the core.
- **Question 2, reshaped by the split:**
  - **Core:** the allowlist leaves code for a **node file** of allowed
    key-name / website (/ method) combinations, and **loopback verbs** to
    read and maintain it. Nothing more.
  - **Shell:** the proxy manager — an app says which outside APIs and keys
    it needs, and the owner grants access. That protocol, and the app, are
    shell scope. **Deferred** — Andy: *"the shell side is deferred. the api
    will first be usefull to agents."* The core file and verbs are built
    for agents first (a review, a script); the shell comes to them later.
- **Where the file lives: `relay-state/`**, which answers Andy's question
  yes — verified at `a83f219`: `fileServable()` refuses all of it
  (`spirit/run/js/kernel.js:291`), the `fs.*` verbs cannot write it (writable
  roots are `app/`, `media/`, `published/` and `preferences.json`,
  `kernel.js:176`, `184`), and git ignores it (`.gitignore:66`). So only the
  new verbs change it, and an app cannot quietly add "send my key to this
  site" through the file door. It holds names, websites and methods — the
  secrets stay in the environment.

### Waiting and size — decided 2026-09-22

> **Andy:** *"wait times are not the proxies concern. the size limit is a
> separate question. proxied requests are generally not meant for the
> SpiritOS routning services, and often are GET, etc. so size limits would
> break the proxy facility real quick."*

- **Question 3: the proxy imposes no wait of its own.** It waits as long as
  the caller asked (`timeoutMs`), or as long as the far end takes when the
  caller names none. So the 10-second default (`server.js:488`) goes, and so
  does Node `fetch`'s own 300-second cut (fact 3), which is a wait the proxy
  imposes without anyone choosing it.
- **Question 4: the proxy gets no size limits.** Proxied traffic is not
  SpiritOS routing, and a limit shaped for packets would break GETs and
  downloads. **Whether the door's 17 KB body cap should keep applying to a
  `net.fetch` request is a separate question, open** — it is the peer
  packet's bound, inherited because the proxy shares the door (fact 4).

### A website not on the list — decided 2026-09-22

**Allowed, as today.** Because agents here keep their own internet (above),
the proxy is not their only way out, so the list governs **keys** — which
key may go to which website, with which methods — and the owner's **gate**;
it does not fence websites that need no key. A sandboxed environment would
want the opposite; that is its own decision when there is one.

## What bounds the spending, honestly

> **Andy, 2026-09-22:** *"here, in our multi (platform, vscode-instance)
> environment, it is in fact trust, that reigns in grok-account-abuse."*

The message cap is enforced by `grokReview.js`, not by the node. With no
pass (question 1), any program on the box — an agent included — could call
`net.fetch` with the key directly and never meet the cap. What holds spend
back is therefore:

1. **Trust** — the agents keep the rule that a paid call needs Andy's grant
   in words (`design/agents/GROK-REVIEWS.md`).
2. **The prepaid ceiling** — xAI will not spend past the credit Andy loaded.
3. **Seeing it** — the balance is readable at any time (`grokReview.js
   balance`), so a spend nobody granted shows.

Question 5, if built, turns 3 from "readable" into "recorded per call, by
key", whoever made the call.

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
