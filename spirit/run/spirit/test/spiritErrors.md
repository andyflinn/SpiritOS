# spirit/spiritErrors.js — its own test

What an error means, one place for the relay and the node. Owed since the rule *"every production script has its own
test"* (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 10).

- `byCode`: the entry of a known code (`peer-unreachable`: 503, absent, the target's), null for an unknown one.
- `all`: every entry, each its own id and code, none twice; a copy, so emptying it empties nothing.
- `classify`: a known code taken as meant whatever the sentence; an unknown code falls through to the sentence; each
  marker (`busy`, `tooLittleTime`, `gaveUp`, `queueFull`, `stillOpen`) means its condition; an exact sentence, trimmed;
  a runtime sentence by its prefix; anything else unknown, presence null, its status and text kept. `UNKNOWN` claims
  nothing.
- `classifyAnswer`: null for an answer that is ok; a refusal read by its status, error and markers.
- `define`, in a process of its own: the next id, the first sentence its text, the rest defaulted; found by code and by
  sentence; a code defined twice refused, the first kept.

## What its test must try to break

An unknown code read as a known meaning; an uncatalogued sentence that claims presence; a second define that shadows the
first; ids shared; a catalogue a caller can empty.
