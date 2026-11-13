# spirit/nodeCard.js — its own test

What a node answers about itself to anybody who asks (Andy: *"the node should have a verb that is always answered like
name or description"*): the card, one wire word `card` (cycle 10, R1: *"card & description"*), signed by the identity
key over every field and verified from its own bytes. Owed since the rule *"every production script has its own
test"* (goal/G47.1, box v72). Run in process on scratch homes, each with its own identity.json.

- `asks`: a system packet `{ card: true }` is; an app's packet, another question, a chat line, bad JSON are not.
- `describe`: name, description, publicKey, sealKey, at, owner, signed. The counter advances on change, not on
  publication: twice unchanged, the same `at`; a changed description, one higher. An owner in owner.json rides on the
  card, signed, moves the counter, and is never saved into identity.json; an owner.json naming the node itself is no
  owner (goal/G19.8).
- `verify`: the fields of a card signed over exactly those bytes; null for any field changed in flight, a card with no
  owner field or no counter (the flag days), not a card, no signature.
- `signable`: one fixed order, `card`, name, description, publicKey, sealKey, at, owner.
- `cardFrom` (Andy: *"nodeCard.cardFrom we're building towards right now."*): signs an identity in hand; no private
  key, empty.
- `read`: name, description, publicKey, and the description cap from fieldRules.
- `setName`: normalized and stored; 400 for empty, invisible, too long, the name kept. `setDescription`: answers what
  was stored, empty clears, too long refused 400, never cut.
- `rotate` (Andy: *"rotation is a crisis.measure"*): a new seal pair, the old private key gone, the identity key kept,
  the card strictly newer than any handed out, a never-counted node too.

## What its test must try to break

A card a relay could rewrite in flight (a field outside the signature); a counter that never moves, or moves on every
reconnect; a rotated card no newer than the last; a pre-flag-day card accepted by defaulting a field; an owner written
into identity.json.
