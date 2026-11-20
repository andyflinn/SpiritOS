# spirit/type/number/UTC.js

The type spirit.type.number.UTC: a date, a number (the box: "YES, DATE IS A FUCKING NUMBER") (goal/G48.4). Its test: `./UTC.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 0, Date.now(); isValid throws an
error for '2026-11-20', NaN, Infinity, null, new Date().
