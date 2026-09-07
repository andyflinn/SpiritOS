# DICTIONARY.md — words we use with Andy

Agents describe the system with these terms. If you mean something else, say so; do not reuse a word from this file.

Format: **term** — aliases — meaning.

## People and machines

**Andy** — AF, the operator, one operator — The human who owns the repo and the public mailbox. Not a Unix user named `spirit`.

**Work box** — laptop, Windows box, coordinator machine — Andy’s personal computer. Checkout, browser, Claude’s shell. Not spirit-3.

**spirit-3** — VPS, Kamatera, public host, `194.37.81.237` — The rented box that runs the public relay. Root is spirit. Clone is `/root/SpiritOS`.

**Clone** — the checkout — A git copy of SpiritOS. Work box has one. spirit-3 has one. They are not the same process.

## Nodes and ports

**Personal node** — 65432, work node, companion spirit, default server — `node js/server.js` **without** `--relay`. Loopback HTTP only. The browser UI talks to this and only this.

**65432** — work port — Default listen port of a personal node on the same machine as the browser. Not the public mailbox.

**Public relay** — `--relay`, mailbox, VPS relay — `node js/server.js --relay`. Shared claim/send/inbox store. On spirit-3 it binds **65430** behind Caddy, never as a public 65430.

**65430** — relay port, internal Node port — Where the `--relay` process listens on spirit-3. ufw denies it from the world. Caddy proxies 443 → this.

**Caddy** — TLS front — On spirit-3, public `:443` / `:80` for `spirit.andyflinn.com`. Terminates TLS. Forwards to 127.0.0.1:65430.

**spirit.andyflinn.com** — public URL, mailbox URL — The HTTPS name personal nodes put in `relays.json`.

**Lab relay** — fake relay, temp relay — A `--relay` on the laptop (often 65410 / 65430 in temp) for tests. Not spirit-3.

**Fake node** — lab avatar, isolated copy — A temp copy of `spirit/run` made via `git ls-files`. Untracked files do not exist inside it.

## Programs in the tree

**Spirit-shell** — the shell, kernel UI, browser UI — HTML/JS served by the personal node. Apps mount here (Relay Chat, natter, …).

**Relay Chat** — relayChat — The shell app for claim / send / inbox against the mailbox in `relays.json`.

**Natter** — relays.json, relay list — `app/natter/relays.json`: which mailbox URLs this personal node uses. First URL is what hub calls today.

**Hub** — hub.js — Personal-node code that signs and forwards claim/send/inbox/invite to the mailbox over HTTPS (or loopback HTTP for a lab relay).

**whoBook** — private who, perception book — `relay-state/who.json` on a **personal** node. publicKey, publicLabel, myLabel, relays[]. Never uploaded.

**labMaster** — 65420 — Laptop control plane that starts fake nodes. Forbidden on spirit-3.

**Harness** — the test suite, `spirit/test/*` that Claude runs — In-process and loopback tests. No spirit-3 required. “Harness green” means those files’ last lines, not `./bash/status`.

**probe** — relayLab/probe.js — Manual curl-like check of public HTTPS + local 65430. Not part of the harness.

## Identity

**Identity** — keypair, identity.json — Ed25519 keys on the personal node. Private key never leaves the box.

**Public key** — pubkey — The half that may go to a mailbox on claim.

**Public label** — claim name, caption on the wire today — The string peers see on the mailbox (`andy`, `john`). May collide after peer-by-key.

**My label** — private caption, perception — What *you* call that key in whoBook (`lovelyJohn`). Never on the wire.

**Peer-by-key** — peers keyed by public key — Mailbox identity is the key. Same public label can exist twice (two johns).

**Owner** — first claim, allow.json keys[0] — The key that first-claimed (or pending-owner redeemed). Mints invites. Reads `/api/relay/status`. Gets the chat-to-relay census.

**Pending owner** — pending-owner.json — Installer-set name that must win first claim. Cleared after that claim.

**Reserved name** — `relay` — Cannot be claimed. Send-to-`relay` is accepted; census reply is owner-only.

## Allow and invites

**Allow list** — allow.json — Who *may* claim/send. Modes: `open`, `names`, `keys`. Not the same as who has claimed (`mailbox.json`).

**Names-mode** — names allow list — Only listed strings. Live Kamatera as of cycle 4 still this unless cut over.

**Keys-mode** — keys allow list — After first-claim-is-owner. Extra claims need a live **invite** (cycle 4). Owner key may reclaim without invite if mailbox.json was lost.

**Invite** — invite row — `{ token, label, expiresAt, invitedBy, consumedAt }` in `invites.json`.

**Token** — invite token, secret — Random hex. Friend needs this plus the label unless we later mint a speakable token.

**Label** (invite) — invited public label — The public caption the token unlocks (`saint`). Not the token.

**Mint** — POST invite — Owner-signed create of an invite row. Works in keys-mode only.

**Redeem** — consume on claim — Successful claim burns the token before the peer is written.

**Cutover** — Kamatera cutover — Deliberate change of live `relay-state/` (usually names → keys + pending-owner). Never implied by a lab-green harness.

## Process words

**Sitting** — this turn’s work — One opened cycle. Green means stop.

**Cycle** — numbered slice (invite 1–4, A, …) — Spec + test; Claude patches; harness; stop.

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
| 65432 | public mailbox |
| 65430 | something the browser should open |
| harness | `./bash/status` or probe |
| allow list | mailbox.json peers |
| token | public label |
| owner | anyone who claimed |
| VPS | work box |
| GROQ | GROK.md |
