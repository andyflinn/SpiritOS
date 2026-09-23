# Cycle 10 — a relay carries what it cannot read

**Opened 2026-09-23, from `989f39a`. Nothing built yet. Twelve requirements.**

> **Andy:** *"I also want to make sure we have alpha Product at the end,
> and you agreed, or suggested that developper-nerds wouldn't be happy
> about a product where the carrier(relay) can decipher any payload....."*

That is the whole cycle. A developer who reads the code sees today that
the relay handles plaintext; *"the operator is honest"* is not a claim
that survives that audience, and it is the precondition for strangers
sharing one relay (`design/products/CONSIDERATIONS-FOR-EARLY-PRODUCTS.md`
§3).

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

**Verify:** a card whose any field was altered fails; a card signed by the
wrong key fails; a swapped `sealKey` fails.

**Status:** OPEN — cycle 10 is opened, not built.

### R2 — a seal keypair, made where the identity is made

X25519, written into `identity.json` beside the Ed25519 pair. One file to
protect, one file to back up, one file to lose.

**Verify:** a fresh identity has both; an identity from before this cycle
gains a seal key on first start and says so.

**Status:** OPEN — cycle 10 is opened, not built.

### R3 — the card is kept, and accepted from anywhere the signature holds

Acquiring a contact keeps the card on the row, so sealing needs no second
fetch. Because the card is self-signed, **no source is privileged**: it
may arrive on acquisition, on a peer's reply, or later from a census, and
is accepted only if the signature verifies.

**Verify:** a stored card is used without a fetch; an unsigned or badly
signed card never reaches the row.

**Status:** OPEN — cycle 10 is opened, not built.

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
where a node already fetches it — `/api/relay/key` and the census — and
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
