# shell/seal.js

The node's seal, in the browser (goal/G30.11), moved from face/seal.js unchanged (goal/G41.3). X25519, HKDF-SHA256 and
AES-256-GCM through WebCrypto, byte for byte the node's own seal (spirit/seal.js): what one seals the other opens. The
boot requires it onto `spirit.seal` once the face links to its home node.

## API

- `supported()` -> a promise of true when WebCrypto has X25519.
- `newKey()` -> a promise of `{ publicKey, privateKey }`: the public half SPKI DER in base64, as the node's keys are; the
  private half a WebCrypto key, kept in memory only.
- `seal(toSealKey, fromKey, toKey, text)` -> a promise of the sealed value `{ sealed: 1, e, n, c }`.
- `open(myPrivate, myPublicB64, fromKey, toKey, value)` -> a promise of the text, or `null`.

## Requirements

- It lives at `shell/seal.js`; `face/seal.js` is gone.
- It loads on `spirit.seal`, and is also a module, so a test holds it against the node's seal.
- What it seals to a node's key, the node's seal opens, to the same text; what the node's seal seals to its key, it
  opens.
- It opens nothing sealed for another pair: a different `fromKey` or `toKey` gives `null`.
- It opens nothing changed: one byte of the ciphertext changed gives `null`.

## What its test must try to break

- A wrong pair, and a changed byte.
