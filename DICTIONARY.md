# DICTIONARY.md — how Andy says it

**This file answers "what does Andy mean by this word". It is an analysis of Andy's usage, not a glossary explaining experts to him** (`ANDYS_RULES_FOR_AGENTS.md`, preamble). It goes stale when his usage changes. Where his word and the industry's differ, his is the one this project uses; where he has not drawn a distinction an agent needs, the agent draws it out loud and asks rather than importing one silently.

Agents describe the system with these terms and adapt to them, never the reverse. If you mean something else, say so; do not reuse a word from this file.

Format: **term** — aliases — meaning.

## People and machines

**Andy** — AF, the operator, one operator — The human who owns the repo and the public relay. Not a Unix user named `spirit`.

**Work box** — laptop, Windows box, coordinator machine — Andy’s personal computer. Checkout, browser, Claude’s shell. Not spirit-3.

**spirit-3** — VPS, Kamatera, public host, `194.37.81.237` — The rented box that runs the public relay. Root is spirit. Clone is `/root/SpiritOS`.

**Clone** — the checkout — A git copy of SpiritOS. Work box has one. spirit-3 has one. They are not the same process.

## Nodes and ports

**Personal node** — 65432, work node, companion spirit, default server — `node js/server.js` **without** `--relay`. Loopback HTTP only. The browser UI talks to this and only this.

**65432** — work port — Default listen port of a personal node on the same machine as the browser. Not the public relay.

**Public relay** — `--relay`, VPS relay — `node js/server.js --relay`. A **router**: it routes packets between personal nodes by public key, delivers or refuses at once, and **stores nothing on anyone's behalf** (decision 0006). On spirit-3 it binds **65430** behind Caddy, never as a public 65430.

> **"mailbox" was a synonym for this until 2026-09-15** and is retired. It described a real thing — a claim/send/inbox store — and R8 deleted that thing. `relay.js` has said *"there are no mailboxes in the system (Andy). An application may have something it chooses to call one; this layer does not"* since before the deletion; the word is dropped here so the two agree. Occurrences survive in comments about history, which is where a retired word belongs.

**65430** — relay port, internal Node port — Where the `--relay` process listens on spirit-3. ufw denies it from the world. Caddy proxies 443 → this.

**Caddy** — TLS front — On spirit-3, public `:443` / `:80` for `spirit.andyflinn.com`. Terminates TLS. Forwards to 127.0.0.1:65430.

**spirit.andyflinn.com** — public URL, relay URL — The HTTPS name personal nodes put in `relays.json`.

**Lab relay** — fake relay, temp relay — A `--relay` on the laptop (often 65410 / 65430 in temp) for tests. Not spirit-3.

**Fake node** — lab avatar, isolated copy — A temp copy of `spirit/run` made via `git ls-files`. Untracked files do not exist inside it.

## Programs in the tree

**Spirit-shell** — the shell, kernel UI, browser UI — HTML/JS served by the personal node. Apps mount here (Relay Chat, natter, …).

**Spirit group** — the Spirit app, launcher home — The shell's own group screen (Stats, Processes, Jobs, Apps, Groups). Every **intrinsic** app renders here and cannot be moved out — not to None, not to a user group, not back to the desktop. Not a `preferences.groups` entry, so the operator can neither delete nor rename it.

**Relay Chat** — relayChat — The chat app, for any human. Not an admin console: owner-only powers appear inside it only when this node’s key happens to own a relay.

> **Its receive path is BROKEN as of 2026-09-15** and is awaiting a retrofit. It polled `/api/hub/inbox`, which R8 deleted, and its `api.onPacket` handler is an empty stub. Andy's call, taken knowingly: *"I'd rather see apps breaking than apps faking."* Sending already moved to `/api/hub/post`.

**Natter** — relays.json, relay list — The list of public relays this personal node uses (`app/natter/relays.json`). First URL is what hub calls today. A row carries an **owner badge** when this node’s local public key matches the owner on that relay. Natter is an **intrinsic shell app**: it lives in the **Spirit group**, has no location control, and the App Builder cannot overwrite its script or manifest — a node with no relay list can reach nobody at all. Keeps its last public row (`canRemoveRelay`).

**Owner badge** — owned row — The Natter mark meaning *this node’s key is `owner` on that relay*. Zero, one, or several rows may carry it. It is what unlocks create-invitation in Relay Chat. Decided (Andy): the badge is a **signed status 200** on that Natter URL — no extra endpoint unless one proves necessary. The same probe answers *"is this label still mine?"* off the public census (`claimedLabel`), which is where Natter's binding check went when R8 deleted the signed inbox read it used.

**Hub** — hub.js — Personal-node code that signs and forwards claim, post and invite to a relay over HTTPS (or loopback HTTP for a lab relay). It forwarded `send` and `inbox` until R8 (2026-09-15).

**whoBook** — private who, perception book — `relay-state/who.json` on a **personal** node. publicKey, publicLabel, myLabel, relays[]. Never uploaded.

**labMaster** — 65420 — Laptop control plane that starts fake nodes. Forbidden on spirit-3.

**Harness** — the test suite, `spirit/test/*` that Claude runs — In-process and loopback tests. No spirit-3 required. “Harness green” means those files’ last lines, not `./bash/status`.

**probe** — relayLab/probe.js — Manual curl-like check of public HTTPS + local 65430. Not part of the harness.

## Identity

**Identity** — keypair, identity.json — Ed25519 keys on the personal node. Private key never leaves the box.

**Public key** — pubkey — The half that may go to a relay on claim.

**Public label** — claim name, caption on the wire today — The string peers see in a relay's census (`andy`, `john`). May collide after peer-by-key. **Stored once per membership, set once for all of them:** the ledger holds one label per key per relay and two relays may legally disagree, but a person has one name, so **Info** keeps it and posts it to every relay this key holds a seat on. A relay that was down or that refuses (a live invite holding the name) stays out of step, and Info's table is where that shows. *Natter Details used to set it one relay at a time; that panel is gone — Andy: "i have no idea which 'relay' contains which 'label' of mine."*

**My label** — private caption, perception — What *you* call that key in whoBook (`lovelyJohn`). Never on the wire.

**Peer-by-key** — peers keyed by public key — Identity on a relay is the key. Same public label can exist twice (two johns).

**Peer** — the other end, for a node — *Nodes have peers.* Another identity a node corresponds with, named by key. A peer is a person's box.

**Partner** — the other end, for a relay — *Relays have partners.* Another **relay**, promoted by an owner and pinned by its relay key (`partners.json`). Never a person: a relay's counterpart is a box like itself, which is why partnership survives banning the human who owns it.

**Member** — an enrolled row — Who claimed a name on a relay. A relay *has* members; it does not have peers. Note `routingTable.json` still calls this map `peers`, and the public census still answers `{ "peers": [...] }` — naming them from the node's vantage rather than the relay's, and the one place the tree contradicts the line above.

**Owner** — first claim, allow.json keys[0] — The key that first-claimed (or pending-owner redeemed). Mints invites. Reads `/api/relay/status`. Gets the chat-to-relay census.

**Pending owner** — pending-owner.json — Installer-set name that must win first claim. Cleared after that claim.

**Reserved name** — `relay` — Cannot be claimed. Send-to-`relay` is accepted; census reply is owner-only.

## Allow and invites

**Allow list** — allow.json — Who *may* claim. **Two modes: `open`** (no file — a relay before its first claim) **and `keys`**. `names` was a third and went on 2026-09-15: nothing in the tree ever wrote one, and the two gates that gave it meaning died with the ring. Not the same as who has claimed, which is `routingTable.json`.

**Names-mode** — names allow list — Only listed strings. Not what live Kamatera runs any more (see Keys-mode).

**Keys-mode** — keys allow list — After first-claim-is-owner. Extra claims need a live **invite** (cycle 4). Owner key may reclaim without invite if `routingTable.json` was lost. **Live Kamatera runs this since the cutover on 2026-09-07, owner `andy`.**

**Invite** — invite row — `{ token, label, expiresAt, invitedBy, consumedAt }` in `invites.json`.

**Token** — invite token, secret — Random hex. Friend needs this plus the label unless we later mint a speakable token.

**Label** (invite) — invited public label — The public caption the token unlocks (`saint`). Not the token.

**Mint** — POST invite — Owner-signed create of an invite row. Works in keys-mode only.

**Create-invitation** — the invite UI — Where a human mints. Lives in **Relay Chat**, and is shown only if at least one Natter URL carries the owner badge. Several owned rows → the user picks which relay to mint on; it is never guessed from “first URL”. Design only — cycle A.

**Redeem** — consume on claim — Successful claim burns the token before the peer is written.

**Cutover** — Kamatera cutover — Deliberate change of live `relay-state/` (usually names → keys + pending-owner). Never implied by a lab-green harness.

## Process words

**Sitting** — this turn’s work — One opened cycle. Green means stop.

**Cycle** — numbered slice (invite 1–4, A, …) — Spec + test; Claude patches; harness; stop.

**Cycle A** — the create-invitation UI slice — Relay Chat gains create-invitation behind the Natter owner badge. **Not open.** Nothing of A is implemented until Andy opens it; the words above are picture, not backlog.

**Leash** — Paste to Claude — Short verdict Andy copies. No leash in a Grok reply means nothing is for Claude.

**Bones** — ugly implementation — Behaviour without chrome.

**Gates** — inbox sig, send clientKey, bucket sweep, owner census — Must survive bones commits.

**clientKey** — socket key — Rate-limit identity. Behind Caddy this is often `127.0.0.1` for everyone. Not `X-Forwarded-For` until we say so.

**Drop** — file Andy puts in the checkout — New path: full file. Path already on master: cycle `.md` + failing test only.

**Master-only** — no feature branches, no courtesy PRs.

## Do not confuse

| Do not say | If you mean |
|---|---|
| relay | personal node / 65432 |
| 65432 | public relay |
| 65430 | something the browser should open |
| harness | `./bash/status` or probe |
| allow list | the claimed peers in `routingTable.json` |
| token | public label |
| owner | anyone who claimed |
| Natter | Relay Chat |
| owner badge | owner (the key on the relay) |
| mailbox | a relay (the word is retired — see **Public relay**) |
| VPS | work box |
| GROQ | GROK.md |
