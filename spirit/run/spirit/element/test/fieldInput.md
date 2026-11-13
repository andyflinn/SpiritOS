# spirit/element/fieldInput.js — its own test

An input stops at its limit (goal/G32.2; Andy: *"the input tell you how man characters you typed in excess of the limit
instead of simply refusing to take more characters."*). Owed since the rule *"every production script has its own test"*
(goal/G47.1, box v72). The browser file runs in node on a window of its own, the rules the real `spirit/fieldRules.js`;
an input is a stand-in, a keystroke or a paste a `beforeinput` event that records whether it was refused.

- It places `fits` and `attach` at `spirit.required.spirit.element.fieldInput`, and loads `spirit/fieldRules.js` itself
  (rule/26; goal/G41.27).
- `fits`: bytes, never characters (64 `a` and 32 `é` fit a name, 65 and 33 do not); description 128, paragraph 2048, line
  1024; the glyph rule one glyph of at most 8 bytes.
- `attach`: answers the input; a keystroke or a paste past the limit is refused before it lands, one within it taken; a
  two-byte character with one byte left refused; a line break counts its byte; typing over a selection counts what it
  replaces; deleting always works; a refusal leaves the text as it was and draws nothing (it never says how far past);
  no input is answered untouched.

## What its test must try to break

Characters counted in place of bytes; a deletion refused past the limit; a line break let through at the limit; a message
drawn about the excess.
