# 2026-09-12 — the device, and a node defending itself

**Status: CLOSED — this cycle's three device-key requirements are deferred by Andy, 2026-09-26.** Everything else in this cycle was built; the three device-key requirements were not, and he has ruled them abandoned for now rather than owed.

Everything agreed between Andy and Claude on 2026-09-12, in the sitting
that began with Grok's review of [DEVICE.md](../relay/DEVICE.md).

Written retroactively, which is itself the point: the confinement below
(R7) was agreed early, built last, and only because Andy asked whether it
had been done. Six numbered findings from a reviewer became the worklist
and our own agreements did not.

---

## Requirements

### R1 — `listenSet` on the router path
> no node, by protocol, should accept requests from unknown

**Verify:** `spirit/test/frontDoor.js` — "a stranger with a perfect signature reaches no app at all"
**Status:** DONE (`ba66edc`)

### R2 — a floor beneath the preference, in code and not in a file
> can this all be tested … the node should safeguard against unknown keys, regardless of the users wishes

**Verify:** `spirit/test/frontDoor.js` — "a stranger flood is cut off by the byte budget"
**Status:** DONE (`ba66edc`)

### R3 — a node-side enrolment counter
> it's the responsibility of the node-code to safeguard itself, same goes for the satellite

**Verify:** `spirit/test/answerRelay.js` — "five wrong passwords are answered, and the sixth is not answered at all"
**Status:** DONE (`ba66edc`)

### R4 — the stranger policy is node-global, and the floor has no file
> app/contacts/prefs.json is the wrong place for that file, it's a node-global

**Verify:** `spirit/test/contacts.js` — "it keeps nothing on disk — it draws the control, the node holds the value"
**Status:** DONE (`ba66edc`)

### R5 — a relay's key is pinned on disk, and a change is an explicit accept
> the best guard against that is to only use a relay that is somehow certified by 'self'

**Verify:** `spirit/test/relayKeys.js` — "a substituted relay reads as changed, not as new and not as a match"
**Status:** DONE (`ba66edc`)

### R6 — password rotation exists
> the red-button rotate password can easily deny all requests from the old password, that's kind of the point

**Verify:** `spirit/test/deviceEnrol.js` — "every request depending on the old one is denied"
**Status:** DONE (`ba66edc`)

### R7 — a device may post only to its owner's node
> i don't want the relay to allow a device posting to anybody but its owner node, and i know that is cheap. and i know that if a relay allows device post to target peers other than its owner's node, i must end in failure anyway

**THE ONE THIS FILE EXISTS FOR.** Agreed in the same conversation as R1–R6,
built four commits later, and only because Andy asked. Grok had advised
against building it; that advice was treated as authority and it was not.

**Verify:** `spirit/test/devicePeers.js` — "a handheld cannot reach another peer at all"
and `spirit/test/liveFrontDoor.js` — "cannot reach another peer on the relay at all (403)"
**Status:** DONE (`18facff`)

### R8 — a device is not an administrator
> needs fixing

**Verify:** `spirit/test/devicePeers.js` — "the owner-only report takes the house key alone"
**Status:** DONE (`70cdfa0`)

### R9 — a relay's key is pinned before its stream carries anything
Agreed as the fix for the deadlock found by the live pass: the front door
refused the relay because nothing was pinned, so the pinner never ran.

**Verify:** `spirit/test/presenceNode.js` — "every relay it opens a stream to is pinned as well"
**Status:** DONE (`3bb50cf`)

### R10 — the device page is served, not merely permitted
Found by Andy clicking the link. Deleted by accident in the demolition.

**Verify:** `spirit/test/presenceWire.js` — "an identity this relay holds is handed the page"
**Status:** DONE (`7734ecc`)

---

## Agreed, and NOT yet built

These are requirements, not ideas. They are on this list so that the next
completion report has to account for them.

### R11 — the relay holds `deviceKey → ownerKey` in RAM, and never publishes it
> the relay needs to store the public key in the same dataset as it stores the public key of its owner … it's a RAM only part of the ledger the relay keeps

> what the relay is NOT allowed to do is: expose the temporary device ID to any other peer

> the connected device must only appear on the census for its owning node

**Verify:** not written. The negative test Andy named as the one step that
must be tested — the ID in none of: the public census, another peer's
roster, a presence event, a `deviceIdentityPublic` lookup — **plus** the
positive half, or it passes against a device nobody can see at all.
**Status:** DEFERRED: abandoned for now — Andy, 2026-09-26: *"device (cellphone interface with password etc. is abandoned for now)"*. Never built, and not superseded on paper either: the device path was rebuilt differently the same day (`f196322`, `26205fe`). DEFERRED rather than a word of its own, because that is the vocabulary `cycleRequirements.js` enforces — see the note to Andy about the missing term for work that leaves rather than waits.

### R12 — the pairing and the destination rule land together
Recorded in DEVICE.md and repeated here because a note is not a
requirement. Building R11 alone removes the accident that currently stops
a device reaching the router, with nothing underneath it.

**Verify:** not written.
**Status:** DEFERRED: abandoned for now — Andy, 2026-09-26: *"device (cellphone interface with password etc. is abandoned for now)"*. Never built, and not superseded on paper either: the device path was rebuilt differently the same day (`f196322`, `26205fe`). DEFERRED rather than a word of its own, because that is the vocabulary `cycleRequirements.js` enforces — see the note to Andy about the missing term for work that leaves rather than waits.

### R13 — the node's front door must learn its own device keys
`hub.frontDoor` knows contacts+self and accepted relays. A device's
session key is in neither, so the door built on 2026-09-12 would refuse a
device posting to its own node. Found by Andy asking whether the relay
does everything possible.

**Verify:** not written.
**Status:** DEFERRED: abandoned for now — Andy, 2026-09-26: *"device (cellphone interface with password etc. is abandoned for now)"*. Never built, and not superseded on paper either: the device path was rebuilt differently the same day (`f196322`, `26205fe`). DEFERRED rather than a word of its own, because that is the vocabulary `cycleRequirements.js` enforces — see the note to Andy about the missing term for work that leaves rather than waits.

### R14 — `send` / `inbox` / `status` are retired
> I'd rather see apps breaking than apps faking

The device's remaining over-reach lives on the old transport, and so does
chat. Grok's ordering — `consoleExchange` first — applies to the RELAY's
`/api/relay/send`, not the node's `/api/hub/send`; they are two deletions.

**Both deletions happened, in that order.** `consoleExchange` and
`/api/hub/send` on 2026-09-13; `send` and `inbox` on 2026-09-15 as R8 in
[the transport cycle](2026-09-12-transport-below-the-boundary.md), which
is where the costing and the outcome live. The device's over-reach went
with them and is now structural rather than gated: `routePost` verifies
against the row's key alone, so a device signature is not confined — it
never verifies.

**`status` was NOT retired, and this line is corrected rather than
quietly satisfied.** Decision 0010 is later than this requirement and
unbundles it: `GET /api/relay/status` *"owes an argument rather than a
classification"*, and moving it is a reordering of `presenceNode.start`.
Its own sitting.

**The breakage was taken, not avoided.** Relay Chat's receive path was
the ring and has not been retrofitted, which is the epigraph above being
acted on rather than quoted. Natter moved instead: its `/api/hub/inbox`
call was never a read, it was a binding probe, and the public census
answers the same question with no signature at all.

**Verify:** `spirit/test/streamSig.js` (the rule that outlived the verb),
`spirit/test/deviceInbox.js`, `spirit/test/devicePeers.js` and
`spirit/test/deviceDisplace.js` (a device key proves nothing to a relay —
asked of `post` and the stream now, since `send` and `inbox` are gone),
and `spirit/test/natterBind.js` (the probe that moved).
**Status:** DONE — except `status`, which was never this requirement's to
take (see above)

### R15 — the device↔node channel is sealed
**Status:** DEFERRED: every identity is Ed25519, a signature scheme, so
there is nothing to encrypt to. Sealing needs an X25519 key per identity —
a protocol change, and one that introduces encryption to the whole system
rather than to a device. See [DEVICE.md](../relay/DEVICE.md) §5.

### R16 — `relay-state/` is the wrong name on a personal node
**Status:** DEFERRED: same sitting as the `preferences.json` move, which
is done; this is the other half and nothing depends on it.
