# spirit/type/string/commit/script.js

The type spirit.type.string.commit: a commit: 7 to 40 hex characters, lower case (goal/G48.4; a git hash, short or full). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for "ac88be8", "a".repeat(40); isValid throws an error for "ac88be", "AC88BE8", "g000000", "a".repeat(41), "", 5.
