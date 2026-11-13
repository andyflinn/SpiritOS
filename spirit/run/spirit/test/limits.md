# spirit/limits.js — its own test

How big a thing may be, in one place (Andy: *"the redundant package-size limits must be collapsed to one
PAYLOAD_MAX"*). The node, the relay and the page read the same file. Owed since the rule *"every production script has
its own test"* (goal/G47.1, box v72). In process; the seal ceiling is measured off the real `spirit/seal.js`.

- The chosen bounds: `PLAINTEXT_MAX` 16384, `PAYLOAD_MAX` 22528, `WIRE_OVERHEAD` 246 (measured), `WIRE_HEADROOM` 512
  (Andy: *"let's say 512 bytes, avoids edge cases."*), `SEAL_ENVELOPE` 185.
- The derived (Andy, 2026-09-26: *"certain fixed values ("constants") must be derived from underlying constants ...
  figure out the correct formula, and test it."*): `BODY_MAX` = payload + headroom (no route-hint room since
  goal/G47.1, box v69); `STREAM_EVENT_MAX` = 6 x payload + headroom, `STREAM_BACKLOG_MAX` two of them (R35);
  `SEALED_MAX` = 3 x floor((payload - envelope) / 4); `ANSWER_MAX` half of it.
- The seal formula `4 * ceil(utf8(JSON text) / 3) + SEAL_ENVELOPE` holds on real seal output across ASCII, escapes,
  accented, CJK and emoji; `SEALED_MAX` is the exact ceiling (at it fits, one byte more does not); a `PLAINTEXT_MAX` of
  ASCII still travels.
- `fitsSealed` counts escaped UTF-8 bytes, not characters (Andy: *"the payload cap is BYTES."*).
- `fitsWrapped`, `fitsWrappedReply`: the wrapper built and measured against `PAYLOAD_MAX`, escaping counted.
- `boundedGet`: a fitting answer unchanged; one too big refused 413 `answer-too-large` with its byte size, never cut;
  no cap given bounds at `PLAINTEXT_MAX`.

## What its test must try to break

A derived constant written down instead of derived (the chain broken); the floor moved inside the multiply (two bytes
too generous); a byte cap measured in characters; an answer cut instead of refused.
