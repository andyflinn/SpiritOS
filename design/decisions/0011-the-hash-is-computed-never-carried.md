# 0011 — The hash is computed, never carried

**Decided 2026-09-15. Against `dcb0c3c`. Implemented.**

> The post never sends the hash with the post. (Andy)

## The decision

**Every party to a `peerPost` computes the request hash itself, from the signed
bytes it holds.** It is never a field on a request, and nothing ever adopts a
hash it did not compute.

It travels exactly once — on the **reply**, inside the responder's signature —
and that single crossing is the whole mechanism rather than a concession to it.

## Why a request carries no hash

Three parties compute the same value independently:

| who | where | from what |
|---|---|---|
| the sender | `peerPost.js`, `post()` | `requestHash(message)` — the message it just signed |
| the relay | `relay.js`, three sites | `requestHash(signed)` — reconstructed locally |
| **the destination** | `peerPost.js`, arrival | `requestHash(verified)` — rebuilt from the bytes that arrived |

The post body is `{from, to, text, sig}`. There is no hash on it, and there is
no correlation id either — **and the absence of one is the point.**

A request id on the wire could be echoed by anything that saw it. A relay could
return a reply for a request nobody read. The hash cannot be produced without
reconstructing the signed message, so **the only party that can address a reply
correctly is a party that held the request.**

## What the signed hash does for the initiator

Two things, and they are one value doing both:

1. **It proves the intended recipient read the request and constructed the
   reply.** The responder could only arrive at that hash by verifying and
   rebuilding the actual signed message. `receiptMessage` puts the hash *inside*
   what is signed — `'receipt\n' + hash + '\n' + minute` — so a relay can
   neither swap it nor sign in the destination's place.
2. **It says which request is being answered.** `settle(hash)` looks up
   `waiting[hash]`, a table the initiator keyed with a hash it never sent. The
   same value joins the request row and the reply row in its log.

Correlation and proof are the same number. That is why there is nothing else to
correlate with.

### `if (!slot) return false` is a match, not a defence

`settle` ignoring an unknown hash reads like a guard against forgery, and
describing it that way inverts the design — it was described that way once, in
the conversation that produced this file, and the correction is the reason the
file exists. Nothing is being kept out. An unmatched hash is not
dangerous-and-handled; it is **unproducible** without the request.

## The browser is outside the cryptography, and this is its only thread

**The browser has no key and cannot sign.** It never participates in the
protocol above — it asks the node on its own machine to act, and the node signs.

So for a page, the hash is **not proof of anything**. It cannot check a
signature and must not be built as though it could. It is a **correlation token
handed over by a node the page already trusts**, on loopback, on the same
machine. Two places hand it over, and a page needs both:

- **The immediate reply.** `POST /api/hub/*` answers with the hash of the post
  the node made on the page's behalf — so a page that pressed Revoke can name
  the transaction it caused. Before 2026-09-15 the hub computed this and threw
  it away.
- **The stream.** An owner event arriving over SSE carries `cause`: the hash of
  the post that caused it, which the relay had all along —
  `answerSelf(hash, text, who)` receives it and every post-driven verb fires
  from inside. So a page can match an event it is pushed against a request it
  made.

Without the second, one press of Revoke wrote three rows on the node — request,
reply, and the owner event — of which two were a story and one an orphan, and
the page that caused all three knew none of them.

### `cause` is not `hash`

A request row and its reply **are** transaction H. An owner row is a
**consequence** of H. One column for both would have three rows claiming to be
the same transaction, so `cause` is its own field and a reader joins `hash` to
`cause`.

### A claim has no cause, and never will

A claim arrives on an HTTP route rather than as a post, so no hash exists to
name. The absent field is honest; inventing one would have the log assert a
transaction that never happened.

Which gives the general rule:

**The hash is the join key for acts somebody posted. It is not a key for the log
as a whole.** An event a relay merely *witnessed* — a stranger taking a seat —
is joined by the peer key and the time.

## What this binds for anything built later

- **No correlation id on the wire, ever.** It would be the weaker half of a
  mechanism that already works, and the half a forwarder could fake.
- **A log reader may only MATCH hashes it already holds.** The moment anything
  files a row under a hash it received rather than computed, both properties die
  at once — the proof and the addressing — because they were never two things.
  This is the constraint the reader (deferred; see the cycle note) inherits.
- **A page may display a hash and quote it. It may not conclude from one.**
  Verification belongs where the keys are.

## Where it lives

- `relayAuth.js` — `requestHash`, `receiptMessage`, `receiptSignatureOk`
- `peerPost.js` — `post()`, the arrival path, `settle()`, `onReply()`
- `relay.js` — `answerSelf`, `ownerEvent`'s `cause`
- `hub.js` — `askRelay` hands the hash to every `/api/hub/*` handler
- `trafficLog.js` — `hash` on request and reply rows, `cause` on owner rows
- `spirit/test/ownerLog.js` — that an owner event names its cause, and that a
  claim does not
