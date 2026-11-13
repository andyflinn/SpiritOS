# spirit/client/packet.js — its own test

One door for every app: the envelope `{ app, v, id, body, re }` lives inside the relay's `text`, so the wire does not
change. The bound it enforces is asked of `spirit/limits.js` and never restated. Dual target: driven in node, and loaded
in a window of its own as a page loads it. Owed since the rule *"every production script has its own test"*
(goal/G47.1, box v72).

- `VERSION` 1, `ID_BYTES` 16; `MAX_TEXT` is `limits.SEALED_MAX`.
- `randomId`: 32 hex characters from a secure source, each its own; with the test seam, a predictable 32-character
  string.
- `encode`: the exact text `{"app","v","id","body"}`; a fresh secure id when none is given. An app is optional (Andy:
  *"nothing in node and relay should know about apps."*): with none it is omitted, not emptied. `re` rides when given
  and is absent otherwise, so a packet that regards nothing is byte-for-byte what it was. Refused: no body (`body
  required`), a cycle or anything JSON cannot express (`body is not serialisable`).
- The bound in sealed bytes (Andy, 2026-09-26: *"if you want to send an elephant, you better slice it to pieces
  first."*): exactly the limit is taken, one byte more refused; the refusal says `packet too long: <n> sealed bytes of
  <limit>` with `length` and `limit`; CJK the length of an ASCII body that fits is refused; newlines count as escaped.
- `isEnvelope`: our text, with or without an app; not a chat line, a number, null, an array, another version, no body,
  half a packet, hand-typed JSON, an empty or non-string app.
- `decode`: app, v, id, re, body; `re` `''` when absent, app null for a box; never fails: a non-envelope is legacy,
  its text the body, a non-string an empty body.
- `decorate`: every field kept, `packet` added beside them, the message itself untouched; a chat line decorates as
  legacy.
- In a page: `window.spirit.packet` with limits loaded first; without them it asks `spirit.require` for
  `spirit/limits.js` itself and is `window.spirit.packet` once that is in (goal/G47.1, Andy: *"cw, FIX IT!"*, rule/26: what
  it needs, it loads itself).

## A body JSON cannot express

*encode refuses a body JSON cannot express (a function).* `JSON.stringify` drops a function body without a word, which
would answer `ok` with a text that has no `body`, one its own `isEnvelope` rejects (it would arrive as a legacy chat
line). `encode` refuses it as "body is not serialisable", as its comment names it: "A body with a cycle in it, or
something JSON cannot express".

## What its test must try to break

The bound counted in characters, or off by one; `re` or an empty `app` written into every packet; another version
taken as an envelope; a 64-bit or Math.random id; the page load dying on `undefined.PAYLOAD_MAX` instead of naming the
missing script.
