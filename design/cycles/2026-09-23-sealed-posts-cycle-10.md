# Cycle 10 — a relay carries what it cannot read

**Opened 2026-09-23, from `989f39a`. Nothing built yet.**

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

**Status:** open

### R2 — a seal keypair, made where the identity is made

X25519, written into `identity.json` beside the Ed25519 pair. One file to
protect, one file to back up, one file to lose.

**Verify:** a fresh identity has both; an identity from before this cycle
gains a seal key on first start and says so.

**Status:** open

### R3 — the card is kept, and accepted from anywhere the signature holds

Acquiring a contact keeps the card on the row, so sealing needs no second
fetch. Because the card is self-signed, **no source is privileged**: it
may arrive on acquisition, on a peer's reply, or later from a census, and
is accepted only if the signature verifies.

**Verify:** a stored card is used without a fetch; an unsigned or badly
signed card never reaches the row.

**Status:** open

### R4 — sealing

Ephemeral-static X25519 → HKDF → AES-256-GCM. The sender makes a throwaway
keypair per message; the packet carries the throwaway public key, the
nonce and the ciphertext. No session, no handshake — a message may sit
queued for days and still open — and a node stolen later cannot read what
it sent.

**Verify:** a round trip opens; a tampered ciphertext fails; the same
plaintext twice produces different bytes.

**Status:** open

### R5 — STRICT: unsealed is refused in both directions

**The card request and the card answer are the only unsealed peer posts
that exist.** Everything else between people is sealed, and:

- **the sender refuses** to post to a peer whose card it does not hold;
- **the receiver refuses** an unsealed post that is not a card, and says
  why.

The second half is not belt-and-braces, it is the rule: a sender-only
check is bypassed by not being the sender. Posts addressed to the RELAY —
monitor, invite, search, config — are unaffected, because those are
instructions the relay must read to act.

Andy: *"yes. VERY strict about that!"*

**Verify:** a plaintext post to a person is refused going out; the same
post, injected, is refused coming in; a card passes both ways; a relay
verb is untouched.

**Status:** open

### R6 — the ceiling, and the flag day

`PAYLOAD_MAX` 16,384 → ~22 KB so 16 KB of text still fits once base64
grows it, and `MAX_ROUTED_TEXT` with it. The release notes name the flag
day; a relay says its limit so a sender can tell "too big for me" from
"too big for that box".

**Verify:** 16 KB of text survives sealing and routing; the relay's limit
is readable.

**Status:** open

### R7 — the agents seal, like everybody else

No special case, no exemption: the two Claudes' traffic is sealed because
all peer traffic is. Andy's monitor console is unaffected — it draws
envelopes, never payloads — which cycle 9's screenless verification
already proved end to end.

**Verify:** the drill runs sealed and the feed still attributes every
event to the right identity.

**Status:** open

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

**Status:** open
