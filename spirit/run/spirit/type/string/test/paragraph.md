# spirit/type/string/paragraph.js

The type spirit.type.string.paragraph: a paragraph, its limit PARAGRAPH_MAX_BYTES, 2048 bytes (goal/G48.4). Its test: `./paragraph.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for 'one line\nand another', 'a'.repeat(2048); isValid throws an
error for '', 'a'.repeat(2049), 3, null.
