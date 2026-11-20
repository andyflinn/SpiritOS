# spirit/type/string/line.js

The type spirit.type.string.line: one line of text, its limit LINE_MAX_BYTES, 1024 bytes (goal/G48.4). Its test: `./line.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 'one line', 'a'.repeat(1024); isValid throws an
error for '', 'a'.repeat(1025), 5, null.
