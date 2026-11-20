# spirit/type/string/glyph.js

The type spirit.type.string.glyph: one glyph, its limit GLYPH_MAX_BYTES, 8 bytes (goal/G48.4). Its test: `./glyph.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for '🛌', 'a'; isValid throws an
error for '', 'ab', '🛌🛌', 5, null.
