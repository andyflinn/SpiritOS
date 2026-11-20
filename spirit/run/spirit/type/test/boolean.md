# spirit/type/boolean.js

The type spirit.type.boolean: a boolean, true or false and nothing else (the box: "still have to make sure it's actually a fucking boolean"; ""flags" must be booleans") (goal/G48.4). Its test: `./boolean.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; isValid answers true for true, false; isValid throws an
error for 1, 0, 'yes', '', 'true', null, undefined.
