# spirit/type/string/paragraph.js

The type spirit.type.string.paragraph: a paragraph, its limit PARAGRAPH_MAX_BYTES, 2048 bytes (goal/G48.4). Its test: `./paragraph.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 'one line\nand another', 'a'.repeat(2048); isValid throws an
error for '', 'a'.repeat(2049), 3, null.
