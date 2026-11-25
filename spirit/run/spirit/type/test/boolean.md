# spirit/type/boolean.js

The type spirit.type.boolean: a boolean, true or false and nothing else (the box: "still have to make sure it's actually a fucking boolean"; ""flags" must be booleans") (goal/G48.4). Its test: `./boolean.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for true, false; isValid throws an
error for 1, 0, 'yes', '', 'true', null, undefined.
