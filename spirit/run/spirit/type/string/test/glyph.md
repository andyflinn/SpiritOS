# spirit/type/string/glyph.js

The type spirit.type.string.glyph: one glyph of at most 32 bytes (Andy: *"glyphs are capped at 32 bytes, one character."*) (goal/G48.4). Its test: `./glyph.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for '🛌', 'a', '🏃‍♂️' and '👨‍👩‍👧‍👦'; isValid throws an
error for '', 'ab', '🛌🛌', one glyph of 41 bytes, 5, null.
