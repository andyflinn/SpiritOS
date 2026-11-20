# spirit/type/string/glyph.js

The type spirit.type.string.glyph: one glyph, its limit GLYPH_MAX_BYTES, 8 bytes (goal/G48.4). Its test: `./glyph.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for '🛌', 'a'; isValid throws an
error for '', 'ab', '🛌🛌', 5, null.
