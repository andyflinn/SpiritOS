# 2026-09-15 — labels are not identities

**Status: CLOSED. Three requirements, all done, 2026-09-15.**

Opened by Andy, reading the R8 commit. The thread ran from a loose end I
left in that sitting — a signature on a query string — and ended
somewhere else entirely, because the loose end turned out to be one face
of something larger.

> **Andy:** i don't understand the ownerbadge concept at all: the relay
> knows its owner by key, and already filters requests by that, because
> the owner gets a wider peer-post-api than non-owning peers.

He was right, and the same question applied further down. What this cycle
fixes is one thing wearing three faces:

**Peer-by-key settled that identity is a key, and stopped halfway.** The
relay still has places where a LABEL stands in for an identity:

- the owner badge signs a *name* (`status\n<name>`) to prove a *key* owns
  the box
- an invite's label is forced onto the claimer, becoming their public name
- `allow.json` identifies the owner by name; eleven call sites resolve
  through it
- a peer row carries `name` *and* `publicLabel`, and `who()` publishes the
  same value under both keys

The first two are this cycle. The last two are named at the foot as
deferred, with the reason.

---

## What Andy decided, in his words

> after enrollment the public label of an ID is property of the ID, it
> must persist on the relay. A contract would say, the relay owner will
> not be allowed to control the public label of any keyed peer.

> when any peer renames its own/owned public label, it is for example to
> make peer search easier in the "add peer by handle" user interface

> The invite must name/label the peer (phone/email etc) a stolen label
> aquiring a seat can be purged from the relays peer-list

> We are not responsible for the security of the out-of-band channel....
> and we need a way to reasonable enable enrollment without opening a can
> of worms. counter measures for theft: expiry period of invites and
> after-the fact purging of a stolen slot.

> the pre existing label is for out-of-channel (over the phone)
> communication between relay owner and perspective peer.

> failed AND successful attempts should send a notification down the
> owners SSE stream.

> Yes the notice must mention the label, both in failed and in succesful
> claims. This then enters the owners log (it should) and it can be
> reviewed.

> They should go to the log.

---

## The finding that forced it

Verified at `3b1c468`.

**The relay owner chooses every peer's public name, permanently, and the
relay publishes it to the world.**

The chain is forced, with no step optional:

1. `mint` writes the owner's label onto the invite row —
   [relay.js:1048-1050](../../spirit/run/js/relay.js#L1048-L1050), where
   `ask.label` comes straight from the owner's post body.
2. `match` refuses any claim whose name is not that exact label —
   [invites.js:138](../../spirit/run/js/invites.js#L138).
3. So the peer row is written `{name: n, publicLabel: n}` with `n`
   **necessarily** the invite's label —
   [relay.js:442-447](../../spirit/run/js/relay.js#L442-L447).
4. `/api/relay/who` publishes `publicLabel` to anyone, unsigned, no
   credential — `isRelayPublicPath`, [server.js:693](../../spirit/run/js/server.js#L693).
5. Nothing can change it afterwards. There is no rename verb; `publicLabel`
   is written once at claim and never again.

Andy's parenthetical — *phone/email* — is what makes this sharp rather
than merely untidy. Run against `NAME_RE`
([relay.js:65](../../spirit/run/js/relay.js#L65)):

```
refused   email        bella@example.com
refused   phone intl   +447700900123
ACCEPTED  phone local  07700900123
ACCEPTED  name         bella.smith
```

**The one contact identifier the field accepts is the one that would be
most damaging to publish.** An owner doing exactly what Andy describes
would be putting an invitee's phone number into a public census, and
nothing in the system would say a word.

**Three labels, and the tree has words for two**

| | whose | seen by | lives |
|---|---|---|---|
| **`publicLabel`** | the ID's | anyone, unsigned | as long as the peer |
| **`myLabel`** (whoBook) | mine, never uploaded | me | as long as I keep it |
| **the invite's label** | the relay owner's | the owner only | while the reservation stands |

The third has no name in the tree, which is why it was mislabelled as the
first. It is spoken down a phone, like its sibling the token already is —
*"typed by one human and read aloud to another"*
([inviteSpeakable.js:25](../../spirit/test/inviteSpeakable.js#L25)).

**Why the binding was never a defence**

Andy's countermeasures are expiry and purge, and both are already built:
`normalizeDays` caps at **15 days**
([invites.js:71-77](../../spirit/run/js/invites.js#L71-L77)), a claimed
invite is deleted rather than stamped, expired rows are swept at four
touches, and `forgetPeer` is reachable as a signed post. Only the purge
UI is missing.

Against that, the label binding does nothing. A thief holding the token
gets one seat either way; today they get it *under the name of the person
they are impersonating*, which is worse, not better. Detection is
unchanged — the invite vanishes from the panel and the invitee says it
was not them — and the purge is by key regardless, per Andy's own rule
that *"removePeer MUST be by ID"*.

---

## Requirements

### R1 — the invite label stops binding

> **Andy:** the relay owner will not be allowed to control the public
> label of any keyed peer.

**CORRECTED 2026-09-15, before anything was built.** This requirement
first read *"`match(token, label)` → `match(token)`"*, on the argument
that the token identifies the invite uniquely so the label was doing no
security work. Andy:

> since we agreed that we keep the invite flow as is, and invites are
> keyless, i don't understand how we can drop the label out of the
> match() call?

He is right, and the reason is the speakable path. A DEFAULT token is
`crypto.randomBytes(16)` — 128 bits, unguessable
([invites.js:62-64](../../spirit/run/js/invites.js#L62-L64)) — and
against that the label adds nothing. A SPOKEN token is only held to
`NAME_RE`, `^[A-Za-z0-9._-]{1,32}# 2026-09-15 — labels are not identities

**Status: OPEN. Three requirements, none started. No code written.**

Opened by Andy, reading the R8 commit. The thread ran from a loose end I
left in that sitting — a signature on a query string — and ended
somewhere else entirely, because the loose end turned out to be one face
of something larger.

> **Andy:** i don't understand the ownerbadge concept at all: the relay
> knows its owner by key, and already filters requests by that, because
> the owner gets a wider peer-post-api than non-owning peers.

He was right, and the same question applied further down. What this cycle
fixes is one thing wearing three faces:

**Peer-by-key settled that identity is a key, and stopped halfway.** The
relay still has places where a LABEL stands in for an identity:

- the owner badge signs a *name* (`status\n<name>`) to prove a *key* owns
  the box
- an invite's label is forced onto the claimer, becoming their public name
- `allow.json` identifies the owner by name; eleven call sites resolve
  through it
- a peer row carries `name` *and* `publicLabel`, and `who()` publishes the
  same value under both keys

The first two are this cycle. The last two are named at the foot as
deferred, with the reason.

---

## What Andy decided, in his words

> after enrollment the public label of an ID is property of the ID, it
> must persist on the relay. A contract would say, the relay owner will
> not be allowed to control the public label of any keyed peer.

> when any peer renames its own/owned public label, it is for example to
> make peer search easier in the "add peer by handle" user interface

> The invite must name/label the peer (phone/email etc) a stolen label
> aquiring a seat can be purged from the relays peer-list

> We are not responsible for the security of the out-of-band channel....
> and we need a way to reasonable enable enrollment without opening a can
> of worms. counter measures for theft: expiry period of invites and
> after-the fact purging of a stolen slot.

> the pre existing label is for out-of-channel (over the phone)
> communication between relay owner and perspective peer.

> failed AND successful attempts should send a notification down the
> owners SSE stream.

> Yes the notice must mention the label, both in failed and in succesful
> claims. This then enters the owners log (it should) and it can be
> reviewed.

> They should go to the log.

---

## The finding that forced it

Verified at `3b1c468`.

**The relay owner chooses every peer's public name, permanently, and the
relay publishes it to the world.**

The chain is forced, with no step optional:

1. `mint` writes the owner's label onto the invite row —
   [relay.js:1048-1050](../../spirit/run/js/relay.js#L1048-L1050), where
   `ask.label` comes straight from the owner's post body.
2. `match` refuses any claim whose name is not that exact label —
   [invites.js:138](../../spirit/run/js/invites.js#L138).
3. So the peer row is written `{name: n, publicLabel: n}` with `n`
   **necessarily** the invite's label —
   [relay.js:442-447](../../spirit/run/js/relay.js#L442-L447).
4. `/api/relay/who` publishes `publicLabel` to anyone, unsigned, no
   credential — `isRelayPublicPath`, [server.js:693](../../spirit/run/js/server.js#L693).
5. Nothing can change it afterwards. There is no rename verb; `publicLabel`
   is written once at claim and never again.

Andy's parenthetical — *phone/email* — is what makes this sharp rather
than merely untidy. Run against `NAME_RE`
([relay.js:65](../../spirit/run/js/relay.js#L65)):

```
refused   email        bella@example.com
refused   phone intl   +447700900123
ACCEPTED  phone local  07700900123
ACCEPTED  name         bella.smith
```

**The one contact identifier the field accepts is the one that would be
most damaging to publish.** An owner doing exactly what Andy describes
would be putting an invitee's phone number into a public census, and
nothing in the system would say a word.

**Three labels, and the tree has words for two**

| | whose | seen by | lives |
|---|---|---|---|
| **`publicLabel`** | the ID's | anyone, unsigned | as long as the peer |
| **`myLabel`** (whoBook) | mine, never uploaded | me | as long as I keep it |
| **the invite's label** | the relay owner's | the owner only | while the reservation stands |

The third has no name in the tree, which is why it was mislabelled as the
first. It is spoken down a phone, like its sibling the token already is —
*"typed by one human and read aloud to another"*
([inviteSpeakable.js:25](../../spirit/test/inviteSpeakable.js#L25)).

**Why the binding was never a defence**

Andy's countermeasures are expiry and purge, and both are already built:
`normalizeDays` caps at **15 days**
([invites.js:71-77](../../spirit/run/js/invites.js#L71-L77)), a claimed
invite is deleted rather than stamped, expired rows are swept at four
touches, and `forgetPeer` is reachable as a signed post. Only the purge
UI is missing.

Against that, the label binding does nothing. A thief holding the token
gets one seat either way; today they get it *under the name of the person
they are impersonating*, which is worse, not better. Detection is
unchanged — the invite vanishes from the panel and the invitee says it
was not them — and the purge is by key regardless, per Andy's own rule
that *"removePeer MUST be by ID"*.

---

## Requirements

### R1 — the invite label stops binding

> **Andy:** the relay owner will not be allowed to control the public
> label of any keyed peer.

, with **no minimum length and no
entropy floor** ([relay.js:498](../../spirit/run/js/relay.js#L498)). An
owner may mint `saint-bernard`, or `dog`, or `a`.

An invite is keyless — the token is the whole credential — so on the
speakable path the label is the second factor. Removing it would make a
guessed word a complete credential, against a claim limit of 10/min that
is shared globally behind Caddy. The original argument was true of the
hex path and false of the path the speakable token exists for.

**The label is doing two jobs, and only one of them breaks the contract:**

| job | verdict |
|---|---|
| **proof** — you are who this invite was for | **keep.** It is the second factor on a low-entropy token |
| **identity** — what you are called ever after | **goes.** Andy's contract: the owner does not control a keyed peer's public label |

**So `match(token, label)` stays.** What changes is that the invite label
stops being COPIED onto the peer row. A claim carries two strings:

- the **invite label** — matched against the invite, never stored on the
  row, never published
- the **public label** — signed in `claimMessage`, written to the row,
  the claimer's own word

Same two-factor redemption, same speakable flow, and the contact handle
never reaches the census.

**The invite keeps its label** — Andy's panel needs it, and it is the word
the two humans use on the phone. `invites.add` still requires one.

**Blast radius:** `claim()` takes one more argument and stops writing the
invite label to the peer row
([relay.js:340](../../spirit/run/js/relay.js#L340),
[:442-447](../../spirit/run/js/relay.js#L442-L447));
`/api/relay/claim` carries one more field
([server.js:1042](../../spirit/run/js/server.js#L1042)). `invites.match`
and `redeem` are UNCHANGED. `claim` is bootstrap and already outside the
post protocol, so nothing else moves.

**Unchanged:** minting as a signed owner post, the spoken token, the
15-day cap, consume-on-claim, deletion not stamping, expiry deciding the
claim, `revokeInvite(label)`, `invite required` for a second key,
consume-before-write ordering, removal revoking that peer's invites.

**Verify:** `spirit/test/invites.js`, section *"The invite proves; the
claimer names themselves"* — five checks, and the two that matter were
watched failing against the unchanged `relay.js` first:

- *"a wrong invite label is refused even with the right token — the
  second factor holds"*
- *"the right invite label admits a claimer under a name of their own"*
- *"and the phone number on the invite is nowhere in the census"*
- *"nor in invites.json, which the claim consumed"*
- *"and a claim that sends one name still works, falling back to it"*

The block above it — *"invite does not unlock a different label"* —
stands unchanged, which is the second factor asserted from the other end.

**Status:** DONE

### R2 — the owner keeps a log of relay events

> **Andy:** failed AND successful attempts should send a notification
> down the owners SSE stream. […] the notice must mention the label,
> both in failed and in succesful claims. […] They should go to the log
> […] of the owner only. […] **There is a category of events on the relay
> that the owner should have a log of.**

Claim attempts are the first members of that category, not the whole of
it. The requirement is the category.

**What the relay reports today is exactly inverted**

Every `relay-event` the owner can receive is **traffic**:

```
relay.js:1144   refused   peer not reachable
relay.js:1156   post      bytes, hash
relay.js:1191   refused   no such route
relay.js:1194   reply     bytes, hash
```

And **nothing** emits for membership or administration. `claim`,
`forgetPeer`, `mint`, `revokeInvite`, `deviceOffer` and `becomeOwner` all
return silently.

So the relay's only event channel carries the one thing decision 0006
says it must not keep, and carries nothing about the thing the owner is
entitled to keep. On top of that the monitor is **opt-in and live-only** —
`monitoring` defaults off, and a `relay-event` that nobody has a tab open
for is gone. Membership events need a record for precisely the reason
traffic does not: the owner is usually not watching when one happens.

**The line, and it follows from 0006**

**IN — what the box did about who belongs on it:**

- a claim: succeeded, or refused past the rate gate, with the invite label
- a peer removed — by the owner, or by themselves
- an invite minted, revoked, or swept as expired
- a device enrolment offered, accepted or refused
- first-claim-is-owner, and a pending-owner reclaim
- a stream opened with a signature that did not verify — somebody
  attempting to *be* a member

**OUT — traffic, always:**

- `post`, `reply`, delivery refusals — the monitor's subject, live and
  opt-in, and right to stay that way
- payloads, under any circumstances. A relay keeping those is the ring's
  sin in a new file (`trafficLog.js`: *"a relay keeping this same file
  would be holding everybody's messages — not metadata, the content"*)

**And the relay still keeps nothing**

**The relay emits; the owner's node keeps.** Nothing new is stored on the
relay — no event file, no ring, no history. Durability sits on the
owner's own hardware, which is 0006's argument and `trafficLog`'s own.

That also decides what happens when the owner is away: the notice is
lost, because a relay does not queue. The *fact* is not lost — it is in
the roster, the invite list and `claimedAt`.

R1 and R2 **ship together or not at all.** R1 removes a signal — weak, but
a signal — and R2 is what replaces it.

**R2a — the relay sends it.** Claim first, as the member Andy named:
success carries the invite spent, the key that took it and the label it
chose; failure carries the invite attempted and why it was refused. The
rest of the category follows the same shape.

**Bounded, and the bound is free.** `claim()` checks `nameOk` →
`reserved` → `rateOk(claimHits, clientKey, 10/min)` → everything else.
Notify only on refusals **past** the gate: the existing claim limit then
caps notifications at 10/min with no new mechanism. Notify on the 429 and
it is unbounded — the cap refuses the claim but not the attempt. Notify
before the gate and a malformed name is a notification.

`/api/relay/claim` is a public POST, so this is the B1 hazard in a new
dress: *a registry keyed by caller-chosen input grows when a stranger
reaches it.* The gate is what keeps a stranger from driving the owner's
stream.

**Silent when the owner is away** (0006 — a relay does not queue). Not a
gap: `claimedAt` is on the row and published, and the invite is gone from
`liveInvites`, so the next `statusToOwner` on stream-open carries the
fact.

**R2b — the node persists it, in the owner's log and nowhere else.**

> **Andy:** They should go to the log. […] of the owner only.

**This is a known hazard, already written down, now applying to a new
event.** [relay.js:1428-1434](../../spirit/run/js/relay.js#L1428-L1434):

> `presentNow.send(id, …)` addresses ONE sink. The mistake to avoid is
> `broadcast()`, which walks every sink and cannot express a recipient at
> all — it is how every other event on this stream travels, so reaching
> for the familiar one would publish an owner's invites to every
> connected peer.

A claim notice is worse to get wrong than the status report that comment
was written about, because it carries **two** things no other peer may
see: a third party's key, and the owner's out-of-band contact handle for
them. Broadcasting it would publish a phone number to everybody holding a
stream — the same leak R1 closes on the census, reopened on the wire.

So: `presentNow.send(ownerKey, …)`, never `broadcast`. And on the node
side, only a node that owns that relay ever receives one, so only that
node's `trafficLog` ever holds one. A peer with a row on the same relay
sees nothing and logs nothing.

`spirit/test/relayStatus.js` already asserts the negative half for the
status report, for exactly this reason. The new notice needs the same
assertion of its own — a shared comment is not a shared test.

Today a `relay-event` goes relay → `presenceNode` → `relayEvents.note` →
straight out to an open browser ([server.js:386](../../spirit/run/js/server.js#L386),
[:1350](../../spirit/run/js/server.js#L1350)). **Nothing persists it.**
Close the tab and it never happened. `relay-status` is worse — overwritten
per relay, *"kept, not acted on"*.

It goes into `trafficLog`: permanent, append-only, never pruned, already
carrying `relay` on every row and already recording things that did not
deliver (`refused`, `ignored`).

**The cost, stated rather than discovered:** a claim notice has no hash
and is not a packet, so `hash` stops being universal and the file's
subject widens from *router traffic* to *things that happened to this
node*. That touches decision 0009. Andy took it knowingly; it is written
here so a later reader does not think it was an accident.

**R2c — it can be reviewed.** `trafficLog.arrivals()` filters to
`dir === 'in' && admitted`, so claim notices will not surface through the
existing read. Needs a flag or a second read — and must stay contained:
no filter by app, per R13.

**Verify:** `spirit/test/ownerLog.js` — 22 checks, and the suite was
watched failing (9 red) against the unchanged `relay.js` and
`trafficLog.js` first. The ones that carry the requirement:

- *"carrying the owner’s word AND the claimer’s — 07700900123 became bel"*
- *"a failed attempt is reported, not only a successful one"*, with the reason
- *"and a member holding a stream heard none of it"* — the `broadcast`
  negative, asserted for this event and not inherited
- *"and the phone number on the invite is nowhere in a member’s stream"*
- *"a hundred refused attempts from one caller cost 10 notices, not a hundred"*
- *"and a refusal before the gate sends nothing at all"*
- *"a payload on an owner row is dropped, whatever the far end sent"*
- *"and arrivals still answers packets only — the two reads do not mix"*
- *"and it is all still there after a restart"*
- *"the relay grew no new file for any of it"* — 0006 unspent

**Built beyond the claim, because the requirement was the category:**
`invite-minted`, `invite-revoked` and `peer-removed` fire through the
same `ownerEvent`. A sweep of expired invites does not — it happens
inside `invites.js`, which has no sink, and is noted as the one member
still missing.

**Status:** DONE

### R3 — the owner-badge concept is deleted

> **Andy:** the relay knows its owner by key, and already filters requests
> by that.

The badge is not a security mechanism. It is a UI decision computed ahead
of time — *may this browser draw the create-invitation panel?* — because
`AGENT.md` forbids drawing a control whose every value would be refused.

It is redundant three ways:

1. **The census already says so.** `who()` publishes `owner: true|false`
   per row ([relay.js:260-270](../../spirit/run/js/relay.js#L260-L270)),
   unsigned, to anyone. And `claimedFrom` **already fetches and parses
   that exact list**, matching on `publicKey`
   ([ownerBadge.js:171-179](../../spirit/run/js/ownerBadge.js#L171-L179))
   — it has the `owner` flag open in a variable and does not read it.
2. **`statusToOwner` only reaches the owner.** Receiving a `relay-status`
   *is* the badge: the relay sends it to one key and no other, on stream
   open and on presence change, carrying more than the GET returns.
3. **The relay already gates per verb.** `answerSelf` decides
   `isOwner(who)` from the post's own signature
   ([relay.js:997-1050](../../spirit/run/js/relay.js#L997-L1050)).

Deleting it retires `statusPath`, its query-string signature, the signed
GET, `readBadge`, and `statusMessage` — **and `/api/relay/status` loses
its only caller**, which answers decision 0010's last open question by
removal rather than by argument.

**It also fixes the loose end this thread started from.** `statusPath`
puts a signature on a query string, and `statusMessage` is `status\n<name>`
with no minute in it — the only signature on this wire that never
expires. It is also fired at *every* relay in `relays.json`, including
boxes this node holds no row on.

**Corrected from the R8 report:** I said that signature lands in Caddy's
access log. It does not — the Caddyfile has no `log` directive
([bash/caddy/Caddyfile](../../bash/caddy/Caddyfile)) and Caddy v2 writes
no access log without one. The exposure is smaller than I stated: a
never-expiring credential in a URL, one config line away from being
written down, and already written down whenever the upstream errors.

**The one thing that is not free:** the census `owner` flag is written at
claim time while `allow.json` is the live authority `checkOwner` reads.
They are written together and can only diverge by hand-editing
`allow.json` on the box — the documented break-glass path — so the flag
can go stale, not false. Method 2 has no such gap: `statusToOwner` reads
`allow.json` every time.

**Done, and it went further than deleting the badge.** With the badge
gone `/api/relay/status` had no caller, so the route went too — and with
it `statusMessage` and `checkOwner`, neither of which had any other.
That closes decision 0010's last open question by removal.

`probe` lost its `name` parameter as well: it existed only to build the
signed path. It now makes ONE request per relay, the public census, and
signs nothing at all — verified against a live relay: `GET
/api/relay/who` alone, no `sig=` anywhere, correct badge.

**Verify:** `spirit/test/cycleA.js`, `spirit/test/protocolSurface.js`,
`spirit/test/streamSig.js`, `spirit/test/natterDetails.js`,
`spirit/test/firstOwner.js`, `spirit/test/devicePeers.js` —

- `spirit/test/cycleA.js` — *"What counts as a badge"*, rewritten onto
  `ownedFrom`: my key with `owner:true` is the badge; another key owning
  it is not; holding a row is not owning one; a keyless node owns
  nothing; four kinds of junk are not a badge; and *"ownerBadge signs
  nothing at all to ask it"* — a source check that `auth.sign(` does not
  appear in live code there.
- `spirit/test/protocolSurface.js` — the register and the tree agree in
  both directions after `/api/relay/status` and `statusMessage` are
  struck from 0010.
- `spirit/test/streamSig.js` — the scan's **exclusion is deleted**, not
  its check: *"no file under run/js builds one at all — 27 scanned,
  nothing excused"*. That carve-out existed for exactly this signature.
- `spirit/test/natterDetails.js` — the owner panel reads the PUSHED
  report (`relayStatus`, keyed by url) and says *"this relay has not
  reported yet"* rather than drawing zeros for a box that has not
  spoken.
- `spirit/test/firstOwner.js` — after a first claim the census marks
  that key as owner *"with no credential asked"*.
- `spirit/test/devicePeers.js` and `liveFrontDoor.js` — the claim the
  two status calls were really making, moved to an owner VERB: *"an
  owner verb takes the house key alone — the handheld never reaches the
  gate"*.

**Live check:** on a fresh relay, `GET /api/relay/status` answers **404**
and the census carries `owner: true` on the owner's row.
`relayProbe.js` moves the route from its live list to its should-404
list, so a deployed box still answering it is visible as running older
code.

**Status:** DONE

---

## Deferred, with reasons

**D1 — `name`/`publicLabel` collapse to one field.** A peer row carries
both, set to the same string; `labelOf()` exists only to reconcile them;
`who()` publishes the same value under both keys. Residue from before
peer-by-key. **Deferred:** it changes the wire, which is a different risk
class from R1–R3, and nothing today is broken by it.

**D2 — rename as an own-row verb.** `answerSelf` beside `removePeer`,
which is already the precedent — *leaving is not a favour you have to ask
for*. Andy's reason for wanting it is real: `handleMatches` matches on
**exact, case-folded `publicLabel`** ([hub.js:276-286](../../spirit/run/js/hub.js#L276-L286)),
so add-by-handle is "say your word out loud and I type it exactly", and
the word is currently chosen by somebody else. **Deferred:** blocked on
D1, and on D3.

**D3 — the owner's label in `allow.json`.** `ownerName(allow)` is
`Object.keys(byName)[0]`, and eleven call sites resolve the owner through
it. An owner renaming its peer row without rewriting `allow.json` in the
same act locks itself out of its own box. Either the rename rewrites it,
or `allow.json` moves to key-first with the name as caption.
**Deferred:** only bites once D2 exists.

**D4 — the purge UI, and the invite panel.** Both app work; the backend
for purge exists end to end (`POST /api/hub/remove-peer` → signed post →
`forgetPeer`, asserted in `removePeer.js`) and has no caller in any app.
**Deferred:** R2 changes what the panel has to show, so it should land
after.

**D5 — the invite-label charset.** If the label is to hold an email,
`NAME_RE` refuses it. Once R1 lands, the invite label no longer has to
obey a public-name rule and can have its own. **Deferred:** wants R1
first, and a decision about what a contact identifier may contain.

---

## What waiting costs

**R1+R2: it is paid by whoever joins in the meantime, and paid
permanently.** Every invite minted before this lands hands somebody a name
they did not pick and cannot change, and publishes the owner's word for
them. That is the only clock on this cycle.

**R3: nothing.** It is a deletion. It gets easier the longer it waits,
not harder — except that the never-expiring signature stays in URLs.

**D1–D5: nothing at all.** Labels being immutable breaks nothing today; it
is an affordance, not a gap.

---

## One correction carried from the R8 sitting

The R8 report said a captured status signature sits in Caddy's access log.
**It does not** — see R3. The rest of that finding stands: the signature
is in a URL rather than a header, and `statusMessage` carries no minute,
making it the only credential on this wire that cannot expire. R3 deletes
it rather than fixing it.
