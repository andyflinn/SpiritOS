# spirit/type/string/description.js

The type spirit.type.string.description: a description, its limit DESCRIPTION_MAX_BYTES, 128 bytes, never empty (goal/G48.4). Its test: `./description.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; isValid answers true for 'said in a few words', 'a'.repeat(128); isValid throws an
error for '', 'a'.repeat(129), 'a\u200db', 7, null.
