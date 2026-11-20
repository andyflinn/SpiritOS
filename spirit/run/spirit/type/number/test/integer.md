# spirit/type/number/integer.js

The type spirit.type.number.integer: an integer (goal/G48.4). Its test: `./integer.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 0, 3, -7; isValid throws an
error for 3.5, '3', NaN, Infinity, null.
