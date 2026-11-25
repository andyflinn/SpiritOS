# spirit/type/object/payload.js

The type spirit.type.object.payload: a payload, an object (goal/G48.4). Its test: `./payload.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for {}, { a: 1 }; isValid throws an
error for [], null, 'x', 5.
