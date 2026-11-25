# spirit/type/string/label/script.js

The type spirit.type.string.label: a label, its limit fieldRules.js's MAX_BYTES, 64 bytes (goal/G48.4). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for 'Andy', 'a'.repeat(64); isValid throws an
error for '', 'a'.repeat(65), 'a\u200db', 5, null, undefined.
