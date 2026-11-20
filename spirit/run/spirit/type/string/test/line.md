# spirit/type/string/line.js

The type spirit.type.string.line: one line of text, its limit LINE_MAX_BYTES, 1024 bytes (goal/G48.4). Its test: `./line.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for 'one line', 'a'.repeat(1024); isValid throws an
error for '', 'a'.repeat(1025), 5, null.
