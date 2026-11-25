# spirit/type/string/description.js

The type spirit.type.string.description: a description, its limit DESCRIPTION_MAX_BYTES, 128 bytes, never empty (goal/G48.4). Its test: `./description.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for 'said in a few words', 'a'.repeat(128); isValid throws an
error for '', 'a'.repeat(129), 'a\u200db', 7, null.
