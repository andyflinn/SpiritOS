# spirit/type/string/word.js

The type spirit.type.string.word: a word, 1 to 32 of letters, digits, dot, underscore or dash, as fieldRules.js's spoken word (goal/G48.4). Its test: `./word.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for 'card', 'a'.repeat(32), 'set_name-2.x'; isValid throws an
error for '', 'a'.repeat(33), 'two words', 'a/b', 5, null.
