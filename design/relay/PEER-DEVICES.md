# Peer devices — every identity brings its own browsers

**Status: designed, not built. Verified against `756013b` (2026-09-10).**

The owner-only version of this shipped as device cycles 1–5 (`2dbffbb`…`756013b`).
This document is about extending it to every claimed peer, and about what that
turns out to mean.

---

## 1. The vision

A person owns a personal node. They also own a phone, a tablet, a browser at
work. Those browsers should be able to act **as them** — read their mail, send
as them, run what they are entitled to run — without being a second person on
the network, and without installing anything.

The relay is what makes it possible, because a personal node is loopback-only:
a phone can never reach it directly. The relay lends the one thing a personal
node lacks — **a public address both sides can reach**.

Done for the owner already. The question is whether every peer on a mailbox
gets the same.

## 2. What exists today

For the **owner only**:

- A 128-character password lives on the personal node (`relay-state/device.json`),
  never on a relay.
- A browser at `/device` posts `{password, devicePublicKey}` — it generates its
  own Ed25519 keypair in WebCrypto and keeps the private half.
- The relay holds that POST in RAM for ≤25s. **It cannot check the password and
  never stores it.**
- While a listening window is open, the node polls the relay every 2s, compares
  the password at home, and installs the device key.
- The key lands as a second key on the owner record (`allow.json`), so every
  gate that asked "is this the owner's signature" now asks it of both.
- One slot: the next enrolment replaces the last.

## 3. Why extending it is feasible

The relay knows exactly two rungs:

| rung | lives in | may do |
|---|---|---|
| **owner** | the one row in `allow.json` | send, read, and the whole console |
| **peer** | a row in `mailbox.json` + its own key | send, read **its own** mail, and `help` / `whoami` |

A peer device is **the owner device one rung down**: a second key on the peer's
row instead of on the owner's row. The gates already learned "either key" — the
same edit, in the same places, against a different record.

No new rung, no new authority, no new transport.

## 4. Six facts that shape any implementation

Each of these cost real effort to establish. They are the reason the obvious
designs are wrong.

**1. The allow list is not the roster.** In keys mode `allow.json` holds exactly
one row — the owner. `ownerName()` is `Object.keys(byName)[0]`
([relayAuth.js:315](../../spirit/run/js/relayAuth.js#L315)). Everyone else is a
claimed peer in `mailbox.json`. "A page per allow entry" would be a feature with
one user.

**2. Labels duplicate; keys do not.** `findByLabel` returns `null` when a label
has more than one holder and `resolveParty` answers `{ambiguous: true}`. A peer
must never claim a label a second time: two rows wearing one name make the
owner's own `inbox` stop resolving. Identity in a URL must therefore be the
**key**, and `peerFile.js` already shows the safe encoding — hex.

**3. A peer's sandbox is subordinate in existence, not in access.** The owner
decides a peer exists (every peer arrived through a minted invite) and sees them
in the census — but cannot read their mail or send as them. `inbox('bert')`
proves against bert's own row key. The rooms are **siblings; one holds the keys
to the building and still cannot open the other door.**

**4. The relay is a rendezvous, not a grantor.** It holds a password it cannot
check, hands it to whoever proves they own that identity, and records the answer.
Every decision happens on the node that owns the password. Each peer's device is
answered by *their* node, during *their* listening window. The owner is not in
the path of anyone else's logins — which is why this scales at all.

**5. A path is not a security boundary; an origin is.** Origin is scheme + host
+ port. Anything served under `https://relay/<anyone>/…` shares one origin with
`/device`, with `/api/relay/*`, and with every other peer's pages — including
their `sessionStorage`, where the device private key lives.

**6. The protocol is the contract, not the kernel.** Four signed strings —
`claim`, `send`, `inbox`, `status` — plus `packet.js`, whose envelope lives
*inside* `text` so a relay stores and returns it without knowing what it is.
Anything that can Ed25519-sign those **is** a peer. `device.html` proves it: 215
lines of vanilla HTML and JS, no kernel, no shell, no build step.

## 5. The proposed shape

**One page, addressed by key.** `/device/<hex key>`, for **everyone including
the owner** — the owner already has a peer row from first claim, so no special
case. What the page may *do* is decided by `isOwner` at the relay, not by which
address was visited.

**Identity in the path, not typed.** The page resolves its own label from the
public `/api/relay/who` and pre-fills a hidden `autocomplete="username"` field
with it. That field is not decoration: it is how a password manager holding
several accounts on one domain shows **which** password to pick.

**The shell hands over a link.** A per-key URL is not typeable, and it does not
need to be. Submitting it once on the desktop is what registers the password
with the browser's password manager for that exact origin — after which sync
carries both the password *and* the URL (via history) to the handheld. The link
is what guarantees the credential is saved against the origin the phone will
later visit.

Ordering rule, worth stating in the UI: **teach the desktop first, then enrol
the phone**, because one slot means the phone displaces the desktop.

**One roaming device per identity.** Everyone gets one, and it is a feature
rather than a limit: one field on the row, no device list, no pruning screen,
and revocation is enrolling somewhere else.

**Per-identity slots.** `deviceHandshake` has one `pending` and one 10/min
bucket for the whole box. With members that must become one slot per identity —
not only for contention, but because `devicePending` returns the password
somebody is *trying*, and a shared slot would show it to every other member.

**Each node watches its own slot — interim by poll, then by doorbell.** Interim:
one request a minute per identity, which is negligible. Arc: one held connection
per identity carrying every notification, not just this one — see
[EVENT-STREAM.md](EVENT-STREAM.md). Either way the slot is per identity, and
`devicePending` answers only the key that owns it.

**Listening stays on.** The flag persists, is honoured at boot, and defaults on,
because a person locked out of their own node while away must not need to travel
home to fix it. That rule applies to every identity, not only the owner.

**Per-identity gates.** `devicePending` / `deviceAnswer` currently verify the
house key. They must verify the key that owns *that* identity, and never answer
one peer with another's slot.

## 6. What this is deliberately not

**Not hosting.** A per-peer namespace for peer-authored pages needs an **origin**
per peer (`<key>.relay-host`, wildcard DNS and certificate), not a path. That
turns a mailbox into a hosting provider. Anyone wanting a different application
stack needs no namespace at all — see fact 6 — they need the four message
formats, and can run their client anywhere.

**Not a console for peers.** The console is the owner's tool:

```
owner :  status  peers  search  invites  key  version  + help  whoami
peer  :  help  whoami
```

A peer who enrols today gets the same handsome page and two words, one of which
tells them their own name. **What a peer's handheld actually wants is their
mail** — read and reply — and that client does not exist yet.

## 7. Cost, and when to build it

Mechanically it is five modifications of things that already exist:

1. a second key on a peer row, and `inbox` / `send` accepting either
2. `devicePending` / `deviceAnswer` gated per identity
3. a slot and a rate bucket per identity
4. `set-device` for a peer row, signed by that peer's key
5. the enrolling peer's node needs "relays I hold a claim on", not `ownedUrls` —
   the badge currently answers a different question

None of it is hard. All of it is surface, on the one box facing the internet.

**Recommended sequence: build the handheld mail client first.** Peer enrolment
delivers a two-word console until something exists behind it; the same work
delivers real value the moment there is mail to read. Building it in the other
order produces a correct feature nobody can use.

**Cost of waiting: none.** The path shape, the second-key-on-a-row pattern and
the per-identity slot all stay available, and none gets harder.

## 8. Open

- **Perception on a handheld.** `whoBook` never leaves a personal node, so a
  device sees handles and key tails where the shell shows captions and marks.
  Either it syncs to one's own devices — a rule change — or a handheld is
  permanently the poorer client.
- **Fan-out.** A device key is installed on one mailbox. A person with two
  relays enrols twice. True for the owner today; would be true for peers.
- **Hidden username fields** are honoured less consistently than visible ones
  (`display:none` worst of all). Worth one check on a real phone before relying
  on it — the same five minutes that settled Ed25519 in WebCrypto.

---

## How this document came to exist

The pattern, recorded because it is reusable: a **sketch in plain words** stating
intent without a mechanism; then **every premise checked against the tree**, so
each claim carries a file and a line; then **corrections in both directions**,
marked where they overturn something rather than silently replacing it. The
output is a translation — decided, recommended, and open, separated — so a third
party can cost the work without re-deriving it, **or decide not to do it.**
