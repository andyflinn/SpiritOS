# spirit/type/string/URL.js

The type spirit.type.string.URL: a URL, http or https (goal/G48.4). Its test: `./URL.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; isValid answers true for 'https://example.com/a', 'http://127.0.0.1:45441'; isValid throws an
error for 'ftp://example.com', 'example.com', '', 'https://a b', 5.
