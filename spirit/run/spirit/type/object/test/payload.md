# spirit/type/object/payload.js

The type spirit.type.object.payload: a payload, an object (goal/G48.4). Its test: `./payload.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for {}, { a: 1 }; isValid throws an
error for [], null, 'x', 5.
