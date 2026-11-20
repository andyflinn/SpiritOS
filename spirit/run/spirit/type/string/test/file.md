# spirit/type/string/file.js

The type spirit.type.string.file: a file (goal/G48.4). Its test: `./file.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; isValid throws an
error for 5, null, undefined, {}.
