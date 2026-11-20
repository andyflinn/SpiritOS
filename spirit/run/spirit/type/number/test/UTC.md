# spirit/type/number/UTC.js

The type spirit.type.number.UTC: a date, a number (the box: "YES, DATE IS A FUCKING NUMBER") (goal/G48.4). Its test: `./UTC.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for 0, Date.now(); isValid throws an
error for '2026-11-20', NaN, Infinity, null, new Date().
