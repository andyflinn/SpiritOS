# spirit/type/string/path.js

The type spirit.type.string.path: a path: it designates a folder and always starts with spirit (the box: "a path ... inside of SpiritOS, must always start with spirit") (goal/G48.4). Its test: `./path.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 'spirit', 'spirit.app.desk'; isValid throws an
error for 'app.desk', 'spirit/app', '', 'spirit..app', 'spirit.app.', 5, null.
