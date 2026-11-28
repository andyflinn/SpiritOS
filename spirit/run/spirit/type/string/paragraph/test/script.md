# spirit/type/string/paragraph/script.js

The type spirit.type.string.paragraph: a paragraph, its limit PARAGRAPH_MAX_BYTES, 2048 bytes (goal/G48.4). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for 'one line\nand another', 'a'.repeat(2048); isValid throws an
error for '', 'a'.repeat(2049), 3, null.
