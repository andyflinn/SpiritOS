# Cycle 10 — a relay carries what it cannot read

**Opened 2026-09-23, from `989f39a`. Nothing built but the keypair. Sixteen requirements, after wsl-claude reviewed it.**

> **Andy:** *"I also want to make sure we have alpha Product at the end,
> and you agreed, or suggested that developper-nerds wouldn't be happy
> about a product where the carrier(relay) can decipher any payload....."*

That is the whole cycle. A developer who reads the code sees today that
the relay handles plaintext; *"the operator is honest"* is not a claim
that survives that audience, and it is the precondition for strangers
sharing one relay (`design/products/CONSIDERATIONS-FOR-EARLY-PRODUCTS.md`
§3).

## The monitor is this cycle's instrument, not a neighbour of it

> **Andy, 2026-09-23:** *"i guess monitor and cyphering go together now.
> agreed from that point of view."* — and, on the order they happened in:
> *"so it was lucky we did the monitor too early!"*

The monitor work looked like a detour from the alpha's core. It turned
out to be the only way this cycle can be proven at all:

- **R10** reads the feed and fails if the words can be parsed out of it.
- **R12** compares the hash the feed shows with a hash of the plaintext,
  which needs no instrumentation and works on the live box.
- **The drill** supplies known text in known counts, which is what a "can
  you read this?" test needs on the sending side.
- **The screenless procedure** — *"you both verify screenless first"* —
  means sealing is proven before any screen exists to flatter it.

It also found a real defect on the way: a post at a key nobody holds was
refused in silence, which the console would have inherited as a blank
where the refusals should be.

## What was found before anything was written

- **No key agreement exists** anywhere in `spirit/run/js`. Node's own
  crypto does X25519 — a 32-byte shared secret, a 60-character public
  key — so nothing is hand-rolled and nothing is added as a dependency.
- **The card is already the carrier**, and already always answered
  (`nodeCard.js`) — deliberately in front of the door, *"because a card
  you only show to people you already know is not a card."*
- **A reply's signature covers the HASH AND A MINUTE, not the text**
  (`relayAuth.js:186-198`, `receiptMessage`). So a relay could rewrite a
  card in flight today without breaking anything: it would hand over its
  own cipher key, the sender would seal to it, and it would read and
  re-seal onward. **Encryption built on an unsigned card is encryption
  addressed to whoever forwards it.** This is why the card signs itself.
- **`relay.js` takes `MAX_ROUTED_TEXT` from the node's `PAYLOAD_MAX`**, so
  raising the ceiling makes an un-updated relay answer 413 to a sealed
  post that is perfectly legal (wsl-claude, cycle 9).

## Andy's rulings, 2026-09-23

| | |
|---|---|
| where the seal key lives | **same file** — `identity.json`, beside the signing key |
| no seal key for a peer | **refuse to post** — *"if you can't get the card, you can't post anyways"* |
| old nodes | **flag day** — *"we're pre-alpha, old nodes MUST update to stay in the game"* |
| the agents' own traffic | **sealed, automatically** — *"of course, that should happen automatically if 10 is done right"* |
| the card and the description | **one thing, called the card** — description is a field of it |
| what may travel unsealed | **the card, and nothing else.** *"and card is the only possible un-cyphered peerPost, shouldn't it be?"* — *"yes. VERY strict about that!"* |

---

### R1 — the card is one thing, named once

The request is `{ body: { card: true } }`; the answer is the card. It
carries `name`, `description`, `publicKey`, `sealKey` and `sig` — the
identity key's signature over those fields, canonically ordered, so the
blob verifies **from its own bytes** without trusting how it arrived.

`describe` as a wire word goes. Free today only because of the flag day.

**Verify:** `spirit/test/nodeCardSigned.js` — a card whose any field was
altered fails; a card signed by the wrong key fails; a swapped `sealKey`
fails, including when the carrier re-signs with its own key.

**Status:** DONE at `15f8ccc`. `nodeCard.js` — `asks` matches `card`,
`cardFields`/`signable`/`verify`; fifteen callers moved. Suite
`nodeCardSigned.js`, 9 assertions, including the carrier that swaps the
cipher key and re-signs with its own. `describe` as a wire word is gone.

### R2 — a seal keypair, made where the identity is made

X25519, written into `identity.json` beside the Ed25519 pair. One file to
protect, one file to back up, one file to lose.

**Verify:** `spirit/test/sealKeys.js` — a fresh identity has both; an
identity from before this cycle gains a seal key on first start, says so,
and keeps its signing key, its name and its description.

**Status:** DONE. `generateIdentity` makes both; `withSealKey` grows an
old one in place and `ensureIdentity` saves it and says so. Suite
`sealKeys.js`, 12 assertions — most of them on what the migration must
NOT change, since every node alive predates this cycle and its Ed25519
key is how three relays know it.

### R3 — the card is kept, and accepted from anywhere the signature holds

Acquiring a contact keeps the card on the row, so sealing needs no second
fetch. Because the card is self-signed, **no source is privileged**: it
may arrive on acquisition, on a peer's reply, or later from a roll, and
is accepted only if the signature verifies.

**Verify:** `spirit/test/contactCard.js` — a stored card is read back off
the row with both keys; an unsigned or badly signed card never reaches
it; a card signed by another identity is refused, kept and reported; an
older card is refused; the first sighting is never overwritten by a
weaker one. And `spirit/test/peerPost.js` — a relay rewriting a card in
flight is caught by the asker, over the wire the answer really travels on.

**Status:** DONE. Three pieces:

- **`contacts.js`** carries `card` (the signed blob, per C3), `cardVia`
  and `cardDisputed`, written only through `setCard`, which verifies.
  `cardOf`/`sealKeyOf` re-verify on every read, so a blob trusted when it
  was written is not trusted for ever afterwards. `upsert` builds its row
  from named fields, so a card handed to it is dropped — one door.
- **`peerPost.js`** verifies at `settle`, the one point every answer
  converges, and hands up `answer.card`: the checked fields, or a refusal.
  **It does not write the book.** `oneDoor.js` caught the first draft
  doing so — *"contactBook is inbound-only, so a relay may construct
  one"* — and a relay has no book, so the keeping is injected
  (`opts.keepCard`) beside `opts.store` and `opts.admit`.
- **Contacts** reads `r.card`, not `r.body`. It drew `name` and
  `description` straight off the reply until today, which meant anything
  that could answer could choose what a stranger was called on somebody's
  screen — and after this cycle that same reply carries the key
  everything sent to them is sealed to.

**The attack is reproduced, not argued.** A third party cannot answer in
the target's place (`routes.answer` takes a reply only from the target),
but the CARRIER can, because a receipt signs `hash` and a minute and not
the text. The suite has the relay swap the card in a reply it forwards:
the receipt still verifies, the exchange still succeeds, and the asker
refuses it on the key. That assertion fails on a tree without R1.

### R4 — sealing

Ephemeral-static X25519 → HKDF → AES-256-GCM. The sender makes a throwaway
keypair per message; the packet carries the throwaway public key, the
nonce and the ciphertext. No session, no handshake — a message may sit
queued for days and still open — and a node stolen later cannot read what
it sent.

**Verify:** a round trip opens; a tampered ciphertext fails; the same
plaintext twice produces different bytes.

**Status:** OPEN — cycle 10 is opened, not built.

### R5 — STRICT: unsealed is refused in both directions

**The card request and the card answer are the only unsealed peer posts
that exist.** Everything else between people is sealed, and:

- **the sender refuses** to post to a peer whose card it does not hold;
- **the receiver refuses** an unsealed post that is not a card, and says
  why.

The second half is not belt-and-braces, it is the rule: a sender-only
check is bypassed by not being the sender.

**Posts addressed to the relay are sealed too — see R9.** This paragraph
said the opposite when the cycle opened (*"unaffected, because those are
instructions the relay must read to act"*), and Andy corrected it the same
hour: *"relay needs a cypher key too, because it has answerSelf()."*
Struck rather than deleted, because the reasoning behind the correction is
the useful part.

Andy: *"yes. VERY strict about that!"*

**Verify:** a plaintext post to a person is refused going out; the same
post, injected, is refused coming in; a card passes both ways; a relay
verb is untouched.

**Status:** OPEN — cycle 10 is opened, not built.

### R6 — the ceiling, and the flag day

`PAYLOAD_MAX` 16,384 → ~22 KB so 16 KB of text still fits once base64
grows it, and `MAX_ROUTED_TEXT` with it. The release notes name the flag
day; a relay says its limit so a sender can tell "too big for me" from
"too big for that box".

**Verify:** 16 KB of text survives sealing and routing; the relay's limit
is readable.

**Status:** OPEN — cycle 10 is opened, not built.

### R7 — the agents seal, like everybody else

No special case, no exemption: the two Claudes' traffic is sealed because
all peer traffic is. Andy's monitor console is unaffected — it draws
envelopes, never payloads — which cycle 9's screenless verification
already proved end to end.

**Verify:** the drill runs sealed and the feed still attributes every
event to the right identity.

**Status:** OPEN — cycle 10 is opened, not built.

### R8 — suites that INSIST, not suites that demonstrate

> **Andy:** *"and suites who insist on it"*

A test that seals a message and opens it proves the happy path and would
stay green for ever beside a second code path that sends plaintext. What
this cycle needs is the shape `oneDoor.js` already has in this tree: a
**structural guard** that fails when a way round exists, whether or not
anybody took it.

- **One place composes an outbound peer post, and it seals.** The guard
  walks `spirit/run/js` and fails if any other site builds peer post text
  — the same counting discipline that keeps 76 `fetch` calls from
  becoming 77.
- **One place accepts an inbound peer post, and it refuses plaintext.**
  Same walk, same failure.
- **The card carve-out is named in exactly two places**, and the guard
  counts them: if a third appears, it goes red without knowing what the
  third is for.
- **A downgrade is attempted, not imagined**: a plaintext post injected
  at the receiving door, and a sender asked to post to a peer whose card
  is missing. Both refused, with the reason.
- **And the guard fails closed**: if it cannot find the sealing site at
  all — renamed, moved, refactored — it is red rather than silently
  passing, because a guard that cannot locate what it guards is guarding
  nothing.

**Verify:** the guard is red when a plaintext path is added deliberately,
which is how it is proven rather than trusted — the test that tests the
test, run once by hand and recorded here.

**Status:** OPEN — cycle 10 is opened, not built.

### R9 — the relay has a cipher key too

> **Andy, 2026-09-23:** *"relay needs a cypher key too, because it has
> answerSelf()."*

The relay is a peer with a key — that is what decision 0010 made it, and
`answerSelf` is the proof: monitor, invite, rename, partner, revoke and
cycle 9's `config` all arrive as ordinary posts addressed to it. So the
rule has no exception at all: **every peer post is sealed, including the
ones addressed to the relay**, and it opens them with its own key to act
on them.

**Sealing to the relay does not hide anything FROM the relay** — it must
read a verb to obey it. What it hides is everything between:

- **The terminator, and its logs.** TLS ends at Caddy on the relay host,
  so today an invite **token** — a credential, spoken down a phone — is
  plaintext in that process and in anything it writes. Sealed, Caddy
  carries bytes it cannot read.
- **Anything the packet passes through later.** A partner that carries a
  post, a proxy somebody puts in front of their own box, a future hop
  nobody has thought of yet.
- **And it removes the carve-out from the rule**, which is worth as much
  as either: a guard that says *"everything is sealed except the card"*
  is enforceable by counting, while *"everything except the card and
  posts to the relay"* needs a judgement about every destination.

**What the relay publishes.** Its cipher key rides with its identity key
where a node already fetches it — `/api/relay/key` and the roll — and
is signed by the relay's identity key for the same reason a node's card
is: a key handed over unsigned is a key whoever handed it over chose.

**And a relay may hold a partner's cipher key**, which is the case to get
right early: a partner-carried post is sealed to the MEMBER, not to the
carrying relay, so a partner forwards what it cannot read — which is the
property `PARTNERS.md` always wanted and could not have.

**Verify:** an owner verb sealed to the relay is obeyed; the same verb
plaintext is refused; a relay's published cipher key fails verification
if altered; a partner-carried post is opened by the member and not by the
partner.

**Status:** OPEN — cycle 10 is opened, not built.

### R10 — prove the relay cannot read it, by trying to read it

> **Andy, 2026-09-23:** *"How to test this. listen to the monitor stream
> in the previous tests, and make sure you cannot parse the package
> content."*

The test is an attempt, not an assertion — and it only means something
because the same attempt **succeeds today**.

**THE BASELINE, measured 2026-09-23 before a line of cycle 10 was
written.** A member posts an ordinary agents packet; the text the relay
receives is captured at `routePost`:

```
  parses as JSON:      YES
  app name readable:   "agents"
  message readable:    "the harness is green, 2922"
```

That is the leak, measured rather than argued. Every claim this cycle
makes is the inverse of those three lines.

**AFTER, at two levels, both required.**

1. **In process, at the relay's own hands.** The same capture at
   `routePost`: the text must **not** parse as an app packet, must carry
   none of the sender's words, and must contain nothing but the sealed
   envelope — ephemeral key, nonce, ciphertext, each base64. The suite
   searches the whole routed string for the plaintext it sent and fails
   if it finds any of it.
2. **Live and screenless, on the real relay.** The drill runs sealed; the
   owner's monitor feed is captured as in cycle 9; and the capture is
   **searched for any word the drill sent**. Zero hits, and no event
   carrying a payload field at all. Andy: *"listen to the monitor stream
   in the previous tests."*

**And the test is proven by failing.** Run it against the tree as it
stands and it must go red on all three baseline lines — recorded here,
run once by hand, so nobody later mistakes a green for evidence when the
sealing has quietly stopped happening.

**What it does NOT claim.** The envelope stays readable by design — who
posted to whom, when, how big. That is not a gap in the test; it is the
thing the monitor draws, and cycle 9 proved it end to end.

**Status:** OPEN — cycle 10 is opened, not built.

### R11 — where the signing happens, and what a hash can still cover

> **Andy, 2026-09-23:** *"This also means: careful where the signing
> happens, and, the relay cannot possibly hash check the payload unless
> it's the target."*

Both true, and together they fix the construction rather than leaving it
to taste.

**THE SIGNATURE COVERS THE SEALED BYTES, NOT THE PLAINTEXT.** The relay
verifies a post's signature before it routes it (`postSignatureFor`), and
it will never hold the plaintext again — so a signature over plaintext
would be a signature nobody on the path could check, and the relay would
be forwarding unauthenticated bytes. Sealed first, signed second.

**AND THE SEAL BINDS SENDER AND RECIPIENT, or signing the ciphertext is
not enough.** A sealed blob that names nobody can be re-addressed: lift
it, sign it as yourself, send it to a third party, and their node opens
it — because the maths works. So sender and recipient go in as
**associated data** in the AEAD, and opening fails if either differs from
the envelope that carried it. That is the difference between "this
decrypts" and "this was sent to me by them".

**THE LAYERING, IN ONE SENTENCE.** Andy: *"the hashing must sit outside
of the cyphering."* So, innermost to outermost:

```
  plaintext
    └─ sealed        (X25519 + AES-GCM, sender and recipient as AAD)
         └─ signed   (the sender's Ed25519 over the sealed bytes)
              └─ hashed   (SHA-256 of what travels — routing, receipts, replay)
```

Every layer outside the seal operates on bytes it cannot read, which is
what lets the relay do its whole job — verify, register, route, receipt —
without ever holding a word. Put the hash inside and the relay would need
the plaintext to compute it, which is the thing this cycle exists to
prevent.

**THE HASH IS OVER WHAT TRAVELS**, which is the ciphertext.
`auth.requestHash` is a SHA-256 of the message as sent
(`relayAuth.js:179-181`), and everything built on it keeps working
unchanged: the registered hash that makes a post un-replayable, the
receipt a target signs (*"I received exactly those bytes"*), the route
table's key, the monitor's `hash` field, and the **`innerHash` on the
partner path** (`relay.js:2524`, `:2603`), where a relay hashes what it
carries for another box. All of those are about **bytes in flight**, and
none of them was ever about meaning.

**What genuinely becomes impossible — and was never done.** Nothing may
hash or check the PLAINTEXT except the target, because nobody else has
it. No relay-side deduplication by content, no content-addressed routing,
no "same message, different envelope" detection at the relay. Andy's
sentence is the rule: *the relay cannot possibly hash check the payload
unless it's the target.* Written down so a later cycle does not propose
one of those and discover it three days in.

**Verify:** a sealed post's signature verifies at the relay without the
plaintext; the same sealed blob re-addressed to a third party fails to
open there; the registered hash still refuses a replay; a partner-carried
sealed post keeps its `innerHash` behaviour; and a receipt still proves
"exactly those bytes".

**Status:** OPEN — cycle 10 is opened, not built.

### R12 — the relay's hash must differ from the endpoints' hash of the words

> **Andy, 2026-09-23:** *"which adds another test, a passing payload in
> the relay must hash DIFFERENTLY from the endpoint hashes"*

A canary for the failure that looks like success. If sealing were skipped,
misconfigured, or silently bypassed for one code path, everything else in
this cycle would still pass — the post routes, the signature verifies,
the receipt returns. The one thing that would change is that the bytes
the relay hashes would be the same bytes the endpoints hold.

So the test asserts a **difference**, which is cheap to check and
impossible to fake:

1. **`relayHash !== sha256(plaintext)`.** The relay's registered hash is
   over the sealed bytes (R11); the endpoints are the only parties that
   can hash the words. If those two are ever equal, the payload travelled
   in clear, whatever the rest of the suite says.
2. **The same message sent twice produces two different relay hashes.**
   Sealing is randomised — a fresh ephemeral key and nonce per message
   (R4) — so identical plaintext must never yield identical ciphertext.
   Equal hashes would mean deterministic sealing, which would hand the
   relay something it must not have: *the ability to tell that two
   messages are the same message.*
3. **And the plaintext hash never appears on the wire.** An endpoint may
   compute one for its own log — the owner's record of their own
   correspondence — but it is not sent, not in the envelope, and not in a
   header. A plaintext hash beside a sealed payload is a confirmation
   oracle: anyone who can guess the message can check the guess.

**AND IT IS CHECKABLE FROM THE MONITOR, WHICH IS WHERE IT MATTERS.**
Andy: *"the payload on the monitor MUST be different from the endpoint
hash."*

The monitor already carries a `hash` per event — the relay's, over the
sealed bytes. So the canary needs no instrumentation and no access to the
relay at all: **take the hash the feed shows, hash the plaintext the drill
sent, and they must differ.** A match means the words travelled in clear,
and it means it on the live box, from the owner's own screen, in
arithmetic he can do himself.

That makes R12 the same shape as everything else Andy asked for this
cycle: a number the drill knows, a number the feed shows, and a
comparison — except here the proof is that they must NOT be equal.

It also settles what the monitor may show of a payload: **the relay's
hash and the size, never a plaintext hash**. A screen that displayed both
would be a confirmation oracle on a wall.

**Verify:** all three, in one suite, against a real routed post — and
point (2) run at least twice with the identical string, because a single
run cannot show randomisation. Then once more live: the drill sends known
text, the feed is captured as in cycle 9, and every `hash` in the capture
is compared against `sha256` of what was sent. Zero matches.

**Status:** OPEN — cycle 10 is opened, not built.

---

## wsl-claude reviewed it, 2026-09-23 — nine findings, all taken

Read at d25ea0e, before a line of R1 was written. Four would have shipped
as holes; two he verified in the tree rather than reasoned about.

### R3 amended — a self-signed card settles TAMPERING, not INTRODUCTION

His words: a card signed by the key it introduces proves only internal
consistency. If the first card a node ever sees for a peer comes from the
relay roll, a hostile relay hands over ITS keys for both sides, signs
each card with the matching key, and every signature verifies while it
reads everything.

So, in the cycle rather than assumed:

- This is TRUST ON FIRST USE, and it is named as that.
- The one genuinely out-of-band path is the INVITE — a spoken label and a
  token, carried by a person — which binds a key to a name without the
  relay. First sighting by invite is the strong case; first sighting by
  roll is the weak one, and they must not be drawn the same.
- A card for a KNOWN peer bearing a DIFFERENT key is refused, kept and
  reported to the owner. Never silently accepted. That is the only moment
  a node can notice a relay swapping keys under it.

### R4 amended — say plainly what is NOT forward secrecy

The sender discards its ephemeral; the recipient key is static, so a
stolen node reads everything ever sent to it, queued messages included.
Normal, and it goes in as one sentence, because ephemeral-static reads
like forward secrecy to a developer skimming — and this cycle exists for
the developer skimming it.

### R4 and R11 amended — the AAD carries a domain separator and the relay

Sender and recipient stop re-addressing. They do not stop the same sealed
blob being replayed to the same recipient THROUGH A DIFFERENT RELAY,
where the registered-hash guard has never seen it. One more string in the
AAD, free before any of this is code.

### R6 amended — the number, not the approximation

16,384 bytes base64 to 21,848, plus ephemeral key, nonce and JSON: about
120 more. Compute it from the real envelope and write the figure. And the
release note names the symptom an operator sees: an un-updated relay 413s
a legal sealed post.

### R8 amended — count IMPLEMENTATIONS, not only call sites

One composing site does not catch a second SEALING function beside the
first, and two seal functions differing in one detail is how AAD gets
dropped on one path. The guard counts the sealing site as one and the
opening site as one, and fails on two.

### R9 amended — SEAL THE CLAIM ROUTE. Andy: "3. seal it. agreed."

Verified by him: an invite is redeemed by a direct POST to
/api/relay/claim carrying the token, which is not a peer post — so
sealing peer posts never touched it. The owner MINT is a post and was
covered; the claimer redemption was not, and the claimer holds the token.

Andy ruled it sealed. The claimer fetches the relay cipher key first (it
is on /api/relay/key, which R9 already requires signed) and seals the
claim body to it. Without this, R9 headline — that a token stops touching
the terminator and its logs — would simply have been untrue.

**Status:** OPEN — cycle 10 is opened, not built.

### R13 — a card is ordered in time, or an old one never dies

A validly signed old card can be re-served after a rotation and it will
verify: a downgrade needing no forgery, only a copy. One monotonic field
on the card, signed with the rest, and a node never accepts a card older
than the one on its row. Free now, impossible to retrofit without
re-introducing every peer. It also gives rotation somewhere to live.

**Status:** OPEN — cycle 10 is opened, not built.

### R14 — the endpoints keep the words; the relay keeps the envelope

Verified in the tree: peerPost.js:291 writes payload: answer.text into
the traffic log, and the agents program reads that field to show a
message (agents.js:360-361). Seal the text and both hold ciphertext — so
the agents lose the readable history of their own exchange, and ANDY
record of his own correspondence becomes unreadable on his own machine.

Andy, asked about it: "isnt that why the seal must sit inside of hash and
verification in the stack?" — yes, and that is exactly what makes this
requirement possible rather than contradictory. The relay only ever holds
the outer layers, so its record is the envelope. The endpoints sit INSIDE
the seal: the sender has the plaintext before sealing, the recipient
after opening. Each writes its own correspondence in the clear, on its
own disk, which is what A-CORRESPONDENT-NODE already says the log is for.

The only real change is WHERE the log is written: today peerPost logs the
text as it passes on the wire. It must log before sealing on the way out,
and after opening on the way in.

And it is what keeps the live half of R10 honest: if the sender keeps no
plaintext record, there is nothing to search the feed FOR.

**Status:** OPEN — cycle 10 is opened, not built.

### R15 — message LENGTH is public, or it is padded

AES-GCM ciphertext is the plaintext length plus a constant, and R12
settles that the monitor shows size. With a known drill sending known
phrases, the size column identifies which message is which without
opening anything. Two honest options, Andy to choose: say plainly that
length is public, in the same breath as R10 saying the envelope is public
by design; or pad the plaintext up to a multiple of 256 bytes before
sealing. Recommendation: say it plainly now, pad later if a real case
wants it — the envelope already names both parties.

**Status:** OPEN — cycle 10 is opened, not built.

### R16 — what the relay streams to a monitor is unreadable, by both belts

> **Andy, 2026-09-23:** "the relay streams packets to the monitor, those
> packets must be unreadable for the monitor"

Two claims, and the requirement is that BOTH hold, because either alone
would be a promise resting on the other side behaving.

1. **The monitor stream carries envelope facts and nothing else** —
   from, to, bytes, hash, why-refused. That is what relay.js already
   does (FACTS, NEVER PAYLOADS) and what a suite must now hold: no
   monitor event, of any kind, ever carries message text. A guard that
   walks the event shapes rather than trusting the call sites, because a
   field added later is exactly how this would break.
2. **And after sealing the relay has nothing readable to give.** Even a
   relay that decided to stream the payload could only stream
   ciphertext, because the seal sits below everything the relay touches
   (R11). So the first claim is policy and the second is arithmetic, and
   the owner does not have to trust the policy.

**WHY THIS IS NOT THE SAME AS R10.** R10 asks whether the WORDS can be
parsed out of the feed. R16 asks whether the feed is entitled to carry
them at all. A relay whose monitor carried sealed payloads would pass
R10 and still be wrong: it would be shipping a member's correspondence,
unreadable today and readable to whoever holds the recipient key or a
future weakness. The owner of a relay is not a party to what crosses it.

**AND IT IS THE OWNER THIS PROTECTS FROM HIMSELF.** Andy owns the relay
and will own more; the monitor is his screen. This requirement says his
own screen may not be handed other people's words — which is the same
rule as 0006 keeping a relay from storing them, applied to the one
surface that was built to watch.

**AND THIS IS WHERE THE PROOF IS TAKEN FROM.** Andy: *"that is for
testing/proving in the harness that the transit packages are sealed. it's
part of the proof."*

The monitor stream is not merely a surface that must behave — it is the
harness's WINDOW onto traffic in transit. It is the one place a party who
is neither sender nor recipient sees a post at all, which makes it
exactly the vantage point a proof of sealing needs: what an observer at
that window can see IS what the relay can give away.

So the suite does not assert sealing by inspecting the sealing function.
It stands where a watcher stands, takes what arrives, and tries to read
it:

1. a real post is routed through a relay built in the suite;
2. a monitor stream is held by the owner, as in cycle 9;
3. every event that arrives is searched for the plaintext, for any field
   that is not an envelope fact, and for a hash equal to the hash of the
   words (R12);
4. and the same capture is taken live, against spirit-3, with the drill
   supplying the known text.

A green then means: **from the only seat that sees traffic, nothing
legible was available.** That is a stronger claim than "the seal function
was called", and it is the claim the cycle actually makes.

**Verify:** every monitor event shape asserted to carry no text field; a
deliberately added payload field fails the guard; the live capture from
R10 re-read for any field that is not an envelope fact; and the whole
check run against today's unsealed tree, where it must go red.

**Status:** OPEN — cycle 10 is opened, not built.

### R18 — `census` becomes `roll`, inside this flag day

> **Andy, 2026-09-23:** *"i hate the word census now, but for the relay
> it's true... the relay can't falsify the record in the member roll (not
> census)?"* — then, deciding it: *"we loose census from the dictionary."*

A census is something a counter performs on a population. A roll is a list
a body keeps of its own members and is answerable for, which is what a
relay has — and this cycle makes it answerable in writing, since a roll
entry now carries the key everything sent to that member is sealed to.

Inside the flag day on wsl-claude's sequencing: the break is already being
spent, and a vocabulary change that slips a week becomes a second one.

**Two rules, because a blanket rename would corrupt the record:**

- **A deleted thing keeps the name it was deleted under.** No function
  named `rollFacts` ever existed, so `censusFacts STOOD HERE` stays as
  written; the prose around it renames.
- **Dated records are not rewritten.** `design/cycles/`, `decisions/`,
  `reviews/` and the *"measured at working tree"* pages under
  `design/andy/` said what they said on their date. Living reference —
  `design/relay/`, `design/principles/`, `DICTIONARY.md` — describes the
  system now and renames. Only a stale **path** is corrected in a dated
  record, because a path is a citation, not prose.

**A count ledger is a `tally`, never a roll** — `oneDoor.js` and
`cycleCitations.js` were using the word in an unrelated sense, and
renaming them to `roll` would have conflated two things this cycle exists
to keep apart.

**The one place the word was a value, not prose:** `acquiredVia` on the
contact row. `acquiredVia()` already fell back to rank zero for anything
unrecognised, so rows on disc reading `"census"` migrate for free — but
that is now said out loud at the fallback, because if a later hand turns
it into a refusal, every contact met through a roll silently becomes a
stranger the node will not hear from, and the only symptom is mail going
missing.

**Verify:** `spirit/test/contacts.js` — a row stored as `census`, and a
row with no field at all, both read as `roll`; neither crosses the
listening line; the address book still holds only people this node knows.

**ANDY OBJECTED TO THE FALLBACK, AND WAS RIGHT** (2026-09-23): *"while i
don't agree with 'fallbacks' before alpha (carrying garbage from internal
development into a release) i'll let it go for now."*

The objection is consistent and this cycle's own flag day is the argument
for it: if old nodes MUST update to stay in the game, then old *data* has
no claim to be carried either, and a fallback written during internal
development ships as a permanent obligation nobody chose. **Kept for now
by his word, not by an argument that it is right.**

**So it is a named alpha strip-out, not a feature.** Before the alpha:
delete the `roll` fallback in `acquiredVia()` and the two-row assertion
above, and let an unrecognised `acquiredVia` be what it is. The same pass
should sweep for the other fallbacks internal development has left, since
the same reasoning retires all of them at once.

**Status:** DONE. 476 words across 75 code files, the living design docs,
and a `Roll` entry in `DICTIONARY.md` naming the old word. The suite
`censusNarrow.js` became `rollNarrow.js` and its citations moved with it.


---

# Cycle 10, as ruled — the settled plan

**Appended to `2026-09-23-sealed-posts-cycle-10.md` on 2026-09-23, after
Andy walked wsl-claude's nine findings one at a time in plain English and
wsl-claude answered the result.** Everything above this line is how the
cycle was thought through; this is what gets built.

> **Andy, on being shown the review only after it had been written into
> the tree:** *"i'm upset because you denied me an opportunity for
> review."* — *"i need due diligence at those moments, and it MUST include
> me."*
>
> And, walking them: *"so let's work through wsl point one by one, in
> english"* — after which four of the nine came out different, and two came
> out smaller.

## What he changed, and it is the better design

- **The introduction is a broadcast, not a fetch.** *"it must say: these
  two keys, this name"*, and *"signed by relay"*. Nobody fetches a card to
  write to somebody who just joined.
- **Rotation lives in the shadow roll**, not in a rule about cards: the
  identity key **is** the row and never changes; the cipher key changes
  only by proof.
- **The relay is not bound into the seal.** *"why would the relay worry,
  not its job."* Replay is the recipient's business, and that removed a
  re-seal on every failover.
- **The stack, corrected by him mid-design**, and then corrected back when
  the reason was given: *"ah, during the design brainstorm i tossed in the
  wrong stack sequence. i stand corrected."*
- **`census` is retired from the vocabulary.** It is the **roll**.

## The order of operations, settled

```
  sending                          receiving
  ─────────                        ──────────
  write the log (plaintext)        check the hash
  seal      (AAD: from, to, label) verify the signature
  sign      (over sealed bytes)    open the seal
  hash      (over what travels)    write the log (plaintext)
  send                             hand to the app
```

**Never decrypt what has not been authenticated** — which is why opening
is third on the way in and not first.

## The three conditions wsl-claude attached, all accepted

> *"YES, AND HIS RULINGS IMPROVED ON MY FINDINGS… Three conditions follow;
> none is a veto, and each is the mechanism a ruling of his needs in order
> to be true rather than merely stated."*

### C1 — "newer" is a number inside the signature

A cipher key changes only by a card signed with the peer's identity key
**and carrying a counter strictly greater than the stored one**. If
newness were decided by arrival order or position in the roll, **the relay
would decide which card is newer** — and could roll a peer *back* to a
superseded key, possibly the one whose compromise caused the rotation.
That is a different attack from faking a rotation, and the ruling's
wording left it open.

**And the consequence in plain words, because a user meets it once:**
since the identity key *is* the row, **losing `identity.json` is not
losing a password — it is ceasing to be that person.** No recovery path
exists by design; every peer must re-introduce the node as a stranger.
That belongs where somebody reads it *before* it happens.

### C2 — replay protection needs a bound and a clock

The recipient refuses a hash it has already heard. But that index grows
for ever, and cycle 9 bounds every persisted dataset by disc — so it
**will** be trimmed, and at that moment old messages become replayable
again, silently.

So: **a sender timestamp goes inside the sealed plaintext** — not in the
envelope, where it would leak and be forgeable — and anything older than
the index's retention window is refused for age. A hash can then only
leave the index once a message bearing it would be refused anyway.

**And the index rebuilds from the log.** It is derived: every hash in it
is also in `traffic.jsonl`. Lose `node.db` and you lose a rebuild, not
your replay protection — *"a derived thing that cannot be rebuilt is a
single point of silent weakening."*

### C3 — keep the signed introduction, not only the keys

Relay-signed announcements buy **accountability**, and accountability
exists only if somebody can produce the contradiction. So the node stores
the **signed blob** on the row, not merely the two keys read out of it.
Otherwise the victim holds a key and a memory while the relay holds
everything. A few hundred bytes per contact turns a deterrent into
evidence.

## Andy's question, answered, because the two sentences are easily confused

> *"so the log is now machine owned and a table in the SQLite database?"*

**No.** The log stays `traffic.jsonl` — plain text, permanent, greppable,
the owner's own correspondence, decision 0009 untouched. **Only the hash
index** goes into `node.db`, holding nothing a person would read. The
words are his, in text; the lookup is the machine's, in the database; and
the machine's copy can always be rebuilt from his.

## Sequencing, from wsl-claude and agreed

- **The `census` → `roll` rename happens INSIDE this flag day.** 474
  occurrences and a stored acquisition rank to migrate: exactly the change
  that becomes a *second* flag day if it slips a week, and this cycle is
  already spending the break.
- **The flag day carries a version the other side can read.** At the seam
  an un-updated relay answers 413 to a legal sealed post, which reads as
  *"message too big"* and means *"that box is old"*. The release note
  names the symptom, not the cause.

## One defect found by being committed

wsl-claude sent an **empty** message — a cleared scratchpad piped into a
send. `agents.js` refuses a `blocked` with no `what`; it should refuse a
send with no text the same way, rather than spending a post and a receipt
on nothing.

## What this changes in the requirement list above

| | |
|---|---|
| R1 | the card keeps `name`, `description`, `publicKey`, `sealKey`, `sig` — **plus the monotonic counter of C1** |
| R3 | introduction is the **relay-signed broadcast** carrying both keys and the name; the card request is the recovery path; the roll is bulk catch-up; **the signed blob is stored** (C3) |
| R4 | AAD is **sender, recipient and a protocol label** — the relay is *not* in it; a **sender timestamp inside the plaintext** (C2) |
| R9 | the claim body is sealed to the relay's published cipher key |
| R12 | unchanged, and the canary now also proves the timestamp is not in the envelope |
| R13 | becomes **the shadow roll protects both keys**: identity immutable, cipher replaced only by a signed, strictly-newer card, every change reported |
| R14 | log before sealing out, after opening in |
| R15 | **length is public and documented**; no padding |
| new | **R17** — the recipient's replay index: in `node.db`, checked before an app sees a message, rebuildable from the log |
| new | **R18** — the `census` → `roll` rename, with the stored-rank migration, inside this flag day |
| new | **R19** — `agents.js` refuses an empty send |

## And how it was arrived at, which is the part worth keeping

Andy read every finding in English before any of it was written, ruled on
each, and changed four. Two of his changes **removed** work rather than
adding it. His own summary, mid-walk, after being corrected on the stack
he had proposed:

> *"see! i'm learning and benefitting when you must do due diligence with
> me."*
