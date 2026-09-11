# Device B2 — the relay's device flow becomes key-addressed

Written by Claude, not Grok — the review budget ran out mid-arc. Andy's
instruction: *"allow Andy to test one-device-for-all from the UI with his
labMaster fakes."* That is the rest of B, and it is three commits.

## The finding that reshapes it

B1 keys the slot by **normalized label** — `normalizeName` trims and
**lowercases**. That is correct while only the owner enrols, because
`allow.json` in keys mode holds exactly one row and its label is unique.

It does not survive peers, for two reasons that are already written down:

1. **Labels duplicate by design.** `findByLabel` returns `null` on
   duplicates, and `relay.js` says it plainly at the claim path — *"Two
   johns is still two keys; it is now also two invites. The label is not
   what is scarce."* A slot keyed by label cannot tell two johns apart.
2. **Lowercasing a key destroys it.** Keys are standard base64
   (`MCowBQYDK2VwAyEAiEDT2U0g+lTROSH7PkKZcfCE4su2X5Ta3BZx2Eggfqo=`), and
   `toLowerCase()` is lossy — two distinct keys can map to one string.

`PEER-DEVICES.md` §5 already resolved this for the URL: **the page is
addressed by key**. B2 carries the same answer inward.

> **The device slot is identified by PUBLIC KEY, never by label.** The
> label stays what it has always been: a display name.

## Shape

**One resolver.** `deviceIdentity(token)` in `relay.js` answers
`{ id, label, publicKey }` for the owner (`allow.byName`) or any peer
(`findByKey` first, `findByLabel` second — and a duplicate label resolves
to nothing, which is the honest answer). `id` **is** the public key.

**The queue stops lowercasing.** `deviceHandshake`'s `normalizeName`
becomes trim-only. Every B1 test passes unchanged — `andy` and `eve` are
already lowercase — and a base64 key survives being an id.

**`deviceGate(token, sig)`** verifies `device-take` against *that
identity's* key rather than against the owner's house key. The row is
selected by key first, so two johns signing the same message bytes each
verify only against their own row. The ambiguity disappears without the
message changing.

**`setDevice`** gains a peer path: verify against the peer's own row key,
write `devicePublicKey` onto the peer row in `mailbox.json`, sibling to
`publicKey`. The owner path is untouched — `allow.json` still gets the
`deviceByName` treatment, and still rewrites every row.

**`send` / `inbox` accept either key** for a peer, the way
`deviceAuth.keysForName` already does for the owner.

**Unknown token is refused before the rate bucket**, as B1 established.

## Out of B2

- `/<key>/device` routing and the page reading its own key — **B3**
- The peer node's "relays I hold a claim on", and Natter drawing the
  panel for a claim row rather than an owned row — **B4**
- `device.html` look. Still frozen except where B3 forces it.

## Tests

`spirit/test/devicePeers.js` — new. Two peers with the same label and
different keys; each enrols its own device; neither can take the other's
slot; a device key reads that peer's inbox and not the other's; the owner
path is unchanged.

Everything in B1 stays green, including `deviceRendezvous.js`.
