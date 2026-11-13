# spirit/answerRelay.js — its own test

What this node knows about the relays it talks to: each relay's own public key, from its key statement (peerPost's
relayKey, the card ask on the relay's one door since goal/G22.6), checked against the pin (relayKeys.js), and the key a
post to it is sealed to (cycle 10, R9). Owed since the rule *"every production script has its own test"* (goal/G47.1,
box v72). The relay's answer is planted, the pin lives in a scratch folder, the statements are signed in process.

- `relayKey`: answers the relay's public key from a statement signed by the identity it names. Trust on first use: a
  relay never met is accepted and pinned on disc. One fetch per run: asked again in the same process, no new ask.
  After a restart it asks again although the key is pinned (the pin-first short-circuit was backed out, 2026-09-18).
- A statement that does not verify yields no key at all, no pin and no seal key: the seal key swapped after signing,
  no signature, the label changed, no key. A relay that does not answer (askKey rejects or throws) yields `''`, and
  `relayKey` never rejects.
- A relay answering another key than the pin is refused, `''`; `onKeyChanged(url, pinned, answered)` is told once;
  the pin does not move; asked again it stays refused. `onKeyChanged` throwing changes nothing, and with none given
  the refusal holds.
- `relaySealKey(url)` and `relaySealKeyByKey(publicKey)`: the seal key from the same signed answer; nothing for a
  relay not asked, an unknown key, or no key.

## Red on the code as it stands

*A refused relay has nothing to seal to by its url either.* `fetchKey` writes `sealOf[url]` before `relayKey` checks
the pin, so after a refusal for a changed key `relaySealKey(url)` answers the substitute's seal key. The comment says a
relay that answers differently "is refused, and stays refused". `relaySealKeyByKey`, the one server.js calls, is safe
(it goes through `keyOf`, which a refused key never reaches); `relaySealKey(url)` has no caller outside this file.

## What its test must try to break

A changed key accepted, or accepted silently; a first sighting not pinned; a statement used without its signature
checked; a fetch on every call; the re-check skipped after a restart; a seal key learned apart from its identity.
