# spirit/type/string/URL.js

The type spirit.type.string.URL: a URL, http or https (goal/G48.4). Its test: `./URL.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for 'https://example.com/a', 'http://127.0.0.1:45441'; isValid throws an
error for 'ftp://example.com', 'example.com', '', 'https://a b', 5.
