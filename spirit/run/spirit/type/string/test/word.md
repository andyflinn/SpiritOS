# spirit/type/string/word.js

The type spirit.type.string.word: a word, 1 to 32 of letters, digits, dot, underscore or dash, as fieldRules.js's spoken word (goal/G48.4). Its test: `./word.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 'card', 'a'.repeat(32), 'set_name-2.x'; isValid throws an
error for '', 'a'.repeat(33), 'two words', 'a/b', 5, null.
