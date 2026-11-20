# spirit/type/string/label.js

The type spirit.type.string.label: a label, its limit fieldRules.js's MAX_BYTES, 64 bytes (goal/G48.4). Its test: `./label.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 'Andy', 'a'.repeat(64); isValid throws an
error for '', 'a'.repeat(65), 'a\u200db', 5, null, undefined.
