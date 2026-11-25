# spirit/type/number/integer/script.js

The type spirit.type.number.integer: an integer (goal/G48.4). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for 0, 3, -7; isValid throws an
error for 3.5, '3', NaN, Infinity, null.
