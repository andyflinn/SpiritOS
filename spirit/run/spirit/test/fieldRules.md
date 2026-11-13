# spirit/fieldRules.js — its own test

What a text field may be, one definition on both sides of the wire (goal/G4.16: *"all occurrences of label and
description must validate at a central point"*). Every maximum is in bytes, never characters; too long is refused,
never cut. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Pure, in process.

- The limits: label 64, description 128, paragraph 2048 (goal/G5.5), email 254 (goal/G40.10), glyph 8 (goal/G41.27),
  chat line 1024 (goal/G41.27). `byteLength` counts UTF-8 bytes.
- `normalize`: NFC, whitespace collapsed and trimmed; a non-string is empty.
- `problem`: a name with spaces and punctuation passes; empty is `name required`; a control, zero-width, bidi override
  or soft hyphen is refused; 64 bytes pass, 65 are `name too long`, counted after normalizing.
- `spokenOk`: 1-32 of `A-Za-z0-9._-`. `leverOk`: a meaning of letters then an iteration `[1-9][0-9]*`, layered on the
  spoken rule (no leading zero, no `0`, no separator).
- `describeProblem`: empty is fine; 129 bytes refused; the invisible refused. `describeRemaining` counts down in bytes.
- `normalizeParagraph` keeps newlines, tabs and spaces, CRLF to LF; `paragraphProblem` required, other controls
  refused, 2049 bytes refused.
- `emailProblem`: each malformed address told why; at most 254 bytes.
- `glyphCount` counts graphemes; `glyphProblem`: one glyph of at most 8 bytes.
- `clip` cuts at maxBytes, never through a character.

## What its test must try to break

A limit counted in characters, or moved off its decided number; a label cut instead of refused; an invisible character
let through; a lever name with a leading zero or a separator accepted; a paragraph whose line breaks are collapsed or
whose CRLF survives; a clip that splits a multi-byte character.
