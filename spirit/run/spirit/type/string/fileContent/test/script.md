# spirit/type/string/fileContent/script.js

The type spirit.type.string.fileContent: a file's content, with no limit (Andy: "i allow "no limit" for spirit/type/string/fileContent/script.js") (goal/G48.4). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for 'one line', 'a'.repeat(5 * 1024 * 1024), 'two\nlines'; isValid throws an
error for 5, {}, [], true.
