# spirit/type/string/file.js

The type spirit.type.string.file: a file (goal/G48.4). Its test: `./file.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid throws an
error for 5, null, undefined, {}.
