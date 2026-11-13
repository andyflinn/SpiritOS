# spirit/puppetMode.js — its own test

A node owned by another node, and the door its owner has (goal/G13.2): `puppetIn`, `ownerCommandIn` (puppets/G5) and
`puppetDoor` (puppets/G7). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). In
process: a scratch folder holds the identity and owner.json, real Ed25519 keys sign the commands, and the door's encode,
post and call are planted.

- `puppetIn`: owner.json naming another key is a puppet; naming its own key, or none, is not (*"pupped is the fate of
  having an owner that is not the self"*); read on every call; a broken owner.json said once, and again only after a fix
  and a new break.
- `ownerCommandIn`: the owner's command signed for this puppet gives verb and body (`{}` when none); not a puppet, 403
  *not a puppet* even for a good signature (Andy's mode gate); another sender, 403 *not the owner*; an app's envelope or
  none (a chat line), 400 *not a command*; a sibling's own signature, a signature absent or wrong (one refusal), one made
  for a sibling, or lifted onto another envelope: 403 *bad command signature*; a cmd that is no JSON or names no verb,
  400.
- `puppetDoor`: the owner's command runs through `call`, and the answer goes back to him with `re` the command's hash; a
  non-puppet, a stranger, a chat line: silent; a failing command: refused to the owner, nothing run; an answer too large
  for a packet: 413 *answer-too-large* with the verb and size, and a log line.

## What its test must try to break

A node owning itself taken as a puppet; a sender check that lets a stranger through; a chat line run as a verb; a
sibling's command accepted; a signature reused on another envelope or puppet; absent and wrong told apart; a too-large
answer dropped in silence; a broken owner.json said on every call.

Not tried: a node with owner.json but no identity.json (`puppetIn` reads `self.publicKey` of a null identity); the
module's comments decide nothing for that case.
