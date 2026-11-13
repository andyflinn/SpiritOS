# spirit/seal.js — its own test

What the relay carries and cannot read (cycle 10, R4): ephemeral-static X25519, HKDF-SHA256, AES-256-GCM, sender and
recipient bound in as associated data. Owed since the rule *"every production script has its own test"* (goal/G47.1,
box v71, 8). Pure, so each test makes its own keys in process.

- `seal`: the wire object `{ sealed: 1, e, n, c }`, a 12-byte nonce; the text is not readable in it; each seal its own
  throwaway key, nonce and ciphertext. Null, never a plaintext, with no recipient key, a bad one, or no sender or
  recipient named.
- `open`: the recipient's key opens it, from the object or its JSON, answering `{ at, text }`, `at` the time given or
  now. Null for another key, another sender or recipient (re-addressed), a changed byte of ciphertext, nonce or
  throwaway key, a ciphertext too short for its tag, no key, nothing sealed, bad JSON.
- `isSealed`: a seal, as object or JSON, is; a plain text, a card-like object, a seal missing a part, a wrong
  `sealed`, bad JSON and null are not.
- `LABEL` is `spirit-seal-v1`.

## What its test must try to break

A plaintext fallback when the recipient's key is bad; a seal that opens re-addressed to a third party (the associated
data dropped); a tampered ciphertext that opens; a nonce or throwaway key reused between seals.
