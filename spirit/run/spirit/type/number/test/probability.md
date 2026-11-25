# spirit/type/number/probability.js

The type spirit.type.number.probability: a probability, a number from 0 to 1 (goal/G48.4). Its test: `./probability.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for 0, 0.5, 1; isValid throws an
error for -0.1, 1.1, NaN, '0.5', null.
