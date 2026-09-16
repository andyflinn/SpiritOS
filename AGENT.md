# AGENT.md — SpiritOS, every agent

Read this before you touch the tree. Use words from `DICTIONARY.md`. `CLAUDE.md` and `GROK.md` only add how that agent delivers work. Product rules live here.

Public face: [andyflinn.com](https://andyflinn.com). Andy Flinn is the one operator.

## What this system is

- A **personal node**, or just **node**, is loopback HTTP on `:65432`. It is identified by a public key, and typically cannot be reached from public IP addresses or via DNS.
- A **public relay**, or just **relay**, (`--relay`) is a router. it routes packets between personal nodes, identified by public keys. On spirit-3 that is Caddy `:443` → Node `:65430`. The name is `https://spirit.andyflinn.com`.
- Personal → public is **HTTPS**, except loopback HTTP for lab relays. Public Node is never advertised on 65430.
- labMaster and lab relays belongs on a **personal development workstation**. Never on the 1 GB public box.

## Comms — one interface, no exceptions

**All comms go through `peerPost`.** It is the one component that provides signed requests over public HTTP, and it owns the mechanics — not just the socket:

- **Signing**, from the node's own key.
- **The hash, computed and never sent** (decision 0011). Each party derives it from bytes it holds: `waiting[hash]` on the asking side (`peerPost.js`, `auth.requestHash`), and derived again *from the bytes that actually arrived* on the answering side. A responder that can produce the hash **read the request** — that is the proof, and it is why the hash never travels except inside a signature.
- **Dispatch by hash.** `settle(hash, answer)` returns a reply to the requester that asked, and to no one else. Late news finds who asked by the same key.
- **The transport, injected** — `opts.request` is `hub.relayRequest`. `peerPost` never reaches for a socket and neither does anything else.

The interface has **two halves**, because a personal node has no public address:

| direction | mechanism |
|---|---|
| out | `relayRequest` — `POST /api/relay/post`, `POST /api/relay/reply` |
| in | the held stream — the relay pushes `request` and `reply` to a node it cannot call |

That is *request by post, reply by stream*. The stream is the **inbound half of the interface**, never a way around it.

**No component reaches for `http`, `https`, `fetch`, `XMLHttpRequest` or `EventSource`.** Not to get something done quickly, not because the interface is awkward here. If the interface is insufficient for the task, **decide**: modify the interface, or grant an explicit, recorded exception. Never work around it. This rule has been re-derived and back-slid more than once — `fetch` is a global in both runtimes, so nothing stops it but this line and `spirit/test/oneDoor.js`.

A relay is a client of the same interface. `createPeerPost` already takes `traffic` injected so a relay can omit it, and touches `whoBook` only on the inbound unknown-sender path — it was built to be constructed on a relay.

## Host

- One operator. **root is spirit.** Clone stays `/root/SpiritOS`.
- No `User=spirit`, no `/opt`. See `bash/ONE-OPERATOR.md`.

## Git

- **`master` only.** Commit when Andy asks or the verdict was “apply this fix.”

## Identity, invites, gates

- Identity = keypair on the personal node. Perception = whoBook, never uploaded.
- Live Kamatera is **keys-mode**, owner `andy`, cut over 2026-09-07 (`CUTOVER.md`). The harness cannot see the VPS, so this line is the only record.
- Extra keys-mode claims need a live invite. Owner key may reclaim if `routingTable.json` is gone (this said `mailbox.json`, renamed 2026-09-13 — a recovery rule naming a file that no longer exists is followed literally at the worst moment).
- Reserved name `relay` cannot be claimed. Chat-to-relay census is owner-only (asserted in `firstOwner.js`, not `relayGates.js`).
- Inbox signed. Send rate-limit on `clientKey`. No `X-Forwarded-For` unless asked.

## UI and test discipline

Andy looks at the spirit-shell whenever a cycle changes what a human sees. That is discipline, not a harness gate.

**Do not show chrome that is not useful to Andy in that state.** A control whose every value would be refused, a form for a capability this node does not have, a field asking a question already answered — none of those are neutral. Each one is a thing to read, decide about and dismiss, and together they are what makes a screen read as a debug console instead of an app. Prefer not building it over hiding it: an intrinsic app has no Location picker in the markup, a node that owns no mailbox has no invite panel in the page, a node already bound has no claim row. When state changes, the chrome comes back on its own — the invite panel when a badge appears, the claim row when the mailbox stops recognising the label — so nothing is lost, only unasked. Where the answer is the mailbox's rather than the app's, ask the mailbox: that is what the owner badge is.

- Target: every **app** will live at `app/<appName>/<appName>.js` plus sibling manifest. Today nine ids still live in `index.html` (stats, files, text-file-launcher, media-launcher, process-browser, jobs, app-manager, group-manager, spirit). They move only per `CLEANUP-PLAN.md`. Intrinsic still does not earn a seat in `index.html`.
- Not apps (do not tidy into `app/`): `js/kernel.js`, `js/client/shell.js`, `index.html`, `js/ownerBadge.js` (script-tag helper). `js/client/browser.js` is unused by `index.html` / `relay.html` / `server.js` — do not assume it is loaded; do not delete it until Andy opens that sitting.
- `mount(container, api, params)` — third argument is real; viewers use it.
- **Apps do not name HTTP paths and do not call `fetch`.** Methods live on `api`; the shell reaches the node, the node reaches the wire — see **Comms** above. This was written as a *target* with a standing pass for Relay Chat, and that is precisely how twelve direct `fetch`es accumulated across six apps: one file had a named exemption, so the next file took one too. The twelve are now a frozen, dated list in `spirit/test/oneDoor.js` — the count goes down or the harness goes red. **Nothing is added to it without Andy granting the exception explicitly.**
- `api.hub.status` means the **badge summary** (`rows`, `ownedUrls`, `mustPick`), not the relay census (`/api/relay/status`).
- `api.fs` is scoped to `app/<name>/` **by convention**. The jail is server-side `fileWritable`. Shared reads via `spirit.core.fs` are not a security regression.
- Kernel rules may be `js/*.js` modules on `api` or a documented script-tag global (`spiritOwnerBadge`). Do not delete `js/ownerBadge.js` as a stray.
- Intrinsic apps sit in the **Spirit** group and cannot be moved or hidden. **Name and icon lock is not true in the tree yet** — later sitting, and it must land *before* Stats/Processes/Jobs/Apps/Groups move.
- First paint must not depend on a failed fs-watcher leaving an empty shell. Decide eager manifest read vs snapshot before that move.
- Natter is the reference *shape* (folder + manifest + `api.fs`). It still uses `spiritOwnerBadge` for the last-relay rule.
- **A UI tweak that stays in the app and off the wire is in-file work.** Layout, copy, marks, CSS, what a filter shows, what a row says — patch the app, run the neighbours, hand it to Andy to look at.
- **A tweak that needs bones surgery is not a tweak.** `relay.js` gates, invite consume, the whoBook schema, a hub URL switch, mailbox identity, a new persist shape — stop and call a team review (Andy + Grok) before writing any of it. The tell is that the UI change cannot be made without changing what crosses the wire or what is stored. **Do not patch `relay.js` so a dropdown works.**

## What you do not do unless asked

- Kamatera cutover
- Moving Stats/Processes/Jobs/Apps/Groups
- Refactoring Relay Chat onto `api.hub`
- Name/icon lock (until that sitting)
- App Builder work (subject to scrap; do not design cleanup around it)
- Treating `preferences.json` / `media/` in this clone as irreplaceable personal data

## Split of labour

- Claude: work-box checkout, review → verdict → patch → harness. No spirit-3.
- Grok: cycle notes + failing tests. No whole-file replace of relay/server/hub/relayAuth.
- Andy: Paste-to-Claude, commits, UI check, spirit-3.
