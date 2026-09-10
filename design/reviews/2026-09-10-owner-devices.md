# Owner devices — a handheld browser that is the owner

**2026-09-10. Andy's design, reviewed against the tree. For Grok.**

Andy's original is `HANDHELD_DEVICES_FOR_RELAY_OWNER.md`, six steps, in the
repo root. This document is the version that survived a read of
`relay.js`, `relayAuth.js`, `hub.js` and `server.js`, plus the exchange that
followed. Where the review changed something, it says so and why. Where a
decision is Andy's and already made, it is marked **decided** — those are not
open for redesign.

Plain words throughout, per Andy: a secret is a **password**.

---

## 1. The goal

Andy owns a personal node at home and one or more public relays. He wants to
use a **web browser on a handheld device he owns** — his own phone, his own
tablet — as himself, without that device being a second person on the network
and without installing anything on it.

The first thing he wants it for is not chat. It is **being the owner while away
from the desk**: mint an invite, approve a claim, read the census of a relay he
owns, from a hotel room. His words: *"that phone bootstrap will one day allow
me to interactively grant access to my relays, wherever I am."*

That target matters for scope, and it is the cheapest useful thing this can
deliver — see §7.

### What makes it coherent

Andy's observation, and the tree agrees with it more strongly than he put it:

> *"my personal node needs only one device key and I can access all my RELAYs
> with the same… its one and only key pair reigns over all RELAYs I own."*

That is exactly what `allow.json` encodes today. In keys mode it holds **one
entry**, `ownerName()` is literally `Object.keys(byName)[0]`
(`relayAuth.js`), and `inbox()` says it in prose: *"the allow list, which in
keys mode is the owner and nobody else."* The allow list is not an access list
that happens to contain the owner — **it is the owner record.**

So a device key is not a new kind of thing. It is a second key on a record that
was built to hold one.

---

## 2. The mechanism

Numbering follows Andy's original so the two can be read side by side.

**1. The node generates and stores one password and one device slot.**
A once-generated 128-character password lives on the personal node, alongside
the identity. The node also keeps **one** current device public key — decided:
one device at a time.

**2. The shell offers a Copy button for the password**, and an explicit
*add a device* window (see step 5's timing note).

**3. — dropped.** Andy's original stashed the password in the relay's RAM so
the relay could check it. The review recommends **the relay holds nothing and
checks nothing.** Reasons:

- The relay is already going to wait for the node (step 5), so it gains nothing
  by knowing the password.
- If the relay checks the password and then tells the node *"register this
  key"*, the node has to take the relay's word for it — so a compromised relay
  could register itself as Andy's device **without ever knowing the password**.
  With the node doing the check, it cannot.
- The relay stays what the pamphlet claims it is: a conduit.

This is a recommendation, not a decision Andy has ratified. It removes a step
rather than adding one.

Step 3 also reserved a handle, **`devices`**, with a public key of its own.
That is not needed either, and §4 explains why it must not exist: a device is
Andy, not a second party, so there is no second name and no second peer row.
`RESERVED_NAME` stays `relay` alone.

**4. A form with one password field**, POSTed to the relay. Not necessarily on
the pamphlet page — see §6 on placement. The browser also generates its **own
Ed25519 keypair** and sends the **public half** with the password.

That inversion is the second review change and the important one. Andy's
original had the relay reply *with the key*; for the browser to use the relay
it must sign (`checkInboxKey`, `checkSend` verify a signature on every read and
send), so that would have had to be a **private** key — travelling through the
VPS and sitting in its RAM. `AGENT.md`: *"Identity = keypair on the personal
node."* With the browser making its own keypair, **nothing secret crosses in
either direction**, and per-device keys come for free, because a WebCrypto
private key cannot be synced between browsers without exporting it.

**5. The relay forwards `{password, devicePublicKey}` to the owner's mailbox
and holds the browser's POST open** until the node answers, or a timeout.

Andy is right that this works — the review initially said the relay could not
call home, which was wrong. The relay cannot *initiate a connection* to the
personal node (loopback-only, `isLoopbackAddress` in `server.js`), but it does
not need to: it leaves a message, and the node picks it up on its sweep. That
is long-polling over machinery that already exists.

Two properties of this, both accepted by Andy:

- **The node must be awake and connected** to add a device. **Decided:
  acceptable.**
- The sweep is **60 s** (`INBOX_SWEEP_MS`, `server.js`), which is past where
  Caddy and phones get bored. The fix doubles as the security control:
  **while the *add a device* window is open in the shell, the node polls fast**
  — a second or two. Outside that window nothing answers at all, so a stolen
  password is inert unless Andy is standing at the machine with the screen open.

**6. The node checks the password, records the device key, and answers.**
The reply carries no secret — it is a yes, plus whatever the browser needs to
address the relay. From here the browser signs its own requests.

### Distribution of the password

**Decided.** Andy pastes the password into Chrome on the desktop once; Chrome's
password sync offers it on his Android. No QR code, no lease, no re-entry, and
128 characters costs nothing because a thumb never types it.

Two consequences worth recording rather than discovering:

- The credential lives in Google's password manager. It is the one part of this
  that leaves Andy's machines. Chosen knowingly.
- A lone password field is saved and offered more reliably inside a real
  `<form>` with `autocomplete="current-password"` and a submit. Worth getting
  right on the first attempt.

### Revocation, in two layers

- **The password** lets a *new* device in. Rotate it and every future device is
  shut out.
- **The device key** is the device. Because there is exactly one slot, **each
  successful handshake replaces the previous device.** Signing in on the phone
  stops the desktop browser; signing in there again stops the phone.

That is what one-at-a-time already means for Andy, and it deletes a subsystem:
no device list, no pruning screen, no "which of these is my old tablet". State
is one field.

---

## 3. What already exists and is reused

| | where |
|---|---|
| owner identity, one keypair, all relays | `relayAuth.loadIdentity`, `identity.json` |
| owner record per relay | `allow.json`, keys mode, single entry |
| node → relay send | `hub.handleSend` → relay `send` |
| relay → node, poll-shaped | `hub.sweepInbox` / `applyInboxBatch`, 60 s |
| signed inbox reads with a time window | `checkInboxKey`, `inboxSignatureOk` |
| owner-only console | `relayConsole.js`, `consoleExchange`, addressed to `relay` |
| one-shot owner-minted tokens | `invites.js` — `mintMessage`, `match`, `consume` |
| conversation kinds on the wire | `packet.js` |

The handshake in §2 needs **no new transport**. Every hop is an existing one.

---

## 4. What is new — and the hazard that decides the shape

### The hazard: the device must not claim a name

The obvious path — the device claims `andy` on the relay with its own key — is
not merely inelegant. It **breaks the owner's mailbox.**

`claim()` guards a duplicate label only when there is no public key
(`if (!publicKey && (peers[n] || findByLabel(n)))`), so in keys mode two rows
*can* end up labelled `andy`. Then:

- `findByLabel('andy')` sees `hits.length === 2`, and `peers['andy']` does not
  exist because `peers` is keyed by public key → returns `null`
- `resolveParty('andy')` falls through to `same.length > 1` → `{ambiguous: true}`
- `inbox('andy')` → **409 `ambiguous label`**

The owner's own inbox stops resolving at that relay. So:

> **The device key gets no peer row.** It is a second key on the *owner record*,
> acting on behalf of the single existing peer row. `peers` stays one row per
> party and `resolveParty` stays unambiguous.

### Consequence: two rungs, no third

**Owner** = a key in `allow.json`; passes `checkSend`, `checkOwner`, the
census, minting. **Peer** = a row in `peers` with its own key; proves its own
inbox reads and nothing more.

There is no limited rung. So the device key is **a second full copy of Andy's
authority on every relay he owns.** Given the goal in §1 that is the right
answer, but it should be chosen consciously: one Chrome-synced password stands
between any browser and owner powers. The guards are the ones in §2 — node
awake, window open, one slot that the next handshake takes.

### The changes this needs

**Relay, `relayAuth.js`** — a name holds more than one key:

- `loadAllow` — `byName[name] = publicKey` becomes a name → keys shape
- `checkSend`, `checkOwner`, `checkInbox` — verify against **any** key for that
  name
- `ownerName` — currently `Object.keys(byName)[0]`; single-entry is baked in
- `writeAllowKeys` — the new shape

**Relay, `relay.js`**:

- `inbox()` gate — today it is *the peer row's key* (`checkInboxKey`) or *the
  allow list* (`checkInbox`), chosen by whether the peer has a key. An owner
  device has no peer row of its own, so this must accept **an owner key for
  that label** as an alternative. Without it the device can send but cannot read.
- a POST route for the browser handshake, with its own rate limit — the
  existing limiters are `claimHits` / `CLAIM_PER_MIN` and the send limiter on
  `clientKey`
- holding the response open, with a timeout, and a clean answer when the node
  never replies

**A verb that can write `allow.json` on a live relay — this is the real new
bone.** `becomeOwner` (`relay.js:203`) is the **only** caller of
`writeAllowKeys` in the entire tree, and it runs once, at the first-owner
claim. Invites do not touch the allow list; they let a claim through and write
a *peer* row. So "one device key works on all my relays" needs an
owner-authenticated way to change the owner record after first claim, which
does not exist in any form today.

This is larger than the password exchange. The natural carrier is the node's
existing outbound sweep: Andy registers a device once at home, and the node
installs the key on each relay it owns, on its own schedule.

**Personal node, `hub.js` / `server.js`**:

- a new packet kind for the device request, named in `packet.js`
- handling it during the sweep: check the password, record the device key, reply
- the faster poll while the *add a device* window is open
- storing the password and the one device key

**Browser**:

- Ed25519 keygen and signing via WebCrypto; private key in IndexedDB, never sent
- the client itself

---

## 5. Feasibility

**The mechanism is sound and the handshake is cheap.** It rides entirely on
existing transport, it needs no inbound connection to the house, and with the
two amendments in §2 no secret ever crosses the wire in either direction.

**Three things carry the real cost**, in order:

1. **The allow-list write verb.** No precedent in the tree. Owner-authenticated
   mutation of the owner record on a live box, propagated to every relay.
2. **Multi-key owner.** Bounded and mechanical, but it touches `checkOwner` —
   the most load-bearing gate on the box — and the `inbox()` gate.
3. **Ed25519 in WebCrypto on Andy's actual phone.** Everything rests on the
   browser being able to sign. Available in current Chrome and Safari, but this
   is a hard dependency and it is five minutes to confirm. **Do this first.**
   If it fails, the whole design needs a different signing story.

**Not costly:** the password, the form, the long-poll, the sweep speed-up, the
Copy button.

**Deliberately out of scope for v1:** anything needing whoBook. Perception
never leaves the personal node (`AGENT.md`), so a handheld has no captions,
labels or marks. For a console-shaped v1 that is invisible, because console
output is machine text. It becomes a real question the day the phone should
look like the shell — and the answer is either "sync my perception to my own
devices", a rule change, or "the handheld is permanently the poorer client".
Better decided on purpose than under pressure.

---

## 6. Open questions for Grok

1. **Ratify or reject dropping the relay-side password stash** (§2 step 3). The
   review recommends the relay hold nothing.
2. **The `allow.json` shape.** Name → array of keys, or an explicit
   `{owner, device}` pair? One device slot is decided, so an unbounded array
   may be more than is wanted.
3. **The allow-list write verb**: its wire shape, what signs it, and whether
   propagation to N relays is the sweep's job or an explicit owner action.
4. **Where the form lives.** `relay.html` is a 22-line static pamphlet today. A
   password field on the public front page of `spirit.andyflinn.com` is chrome
   that is inert whenever no window is open — which `AGENT.md` argues against
   on its own terms. An unlisted path, or a form that only exists while a
   window is live, both satisfy the rule.
5. **Failure shape.** A wrong password should look the same as a missing node
   and the same as a closed window: one answer, no oracle.

---

## 7. Recommended first cycle

Not chat. **The phone as owner-console.**

`relayConsole.js` exists, is owner-only, and answers machine text — so v1 is
the handshake plus a text box that sends console lines addressed to `relay` and
prints what comes back. Mint an invite, approve a claim, read the census, from
anywhere. It is smaller than a chat client, it sidesteps whoBook entirely, and
it is the thing Andy actually asked for.

Chat can follow once a handheld has a reason to hold a keypair.
