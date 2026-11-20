# spirit/type/string/lineFilter.js

The type spirit.type.string.lineFilter: a search line filter: empty for everything, else a line of at most 1024 bytes (Q1, Andy: "a search filter for anything is a different field type, if it has different rules") (goal/G48.4). Its test: `./lineFilter.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for '', 'two words', 'a'.repeat(1024); isValid throws an
error for 'a'.repeat(1025), 5, {}.
