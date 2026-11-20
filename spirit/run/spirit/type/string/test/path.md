# spirit/type/string/path.js

The type spirit.type.string.path: a path: it designates a folder and always starts with spirit (the box: "a path ... inside of SpiritOS, must always start with spirit") (goal/G48.4). Its test: `./path.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for 'spirit', 'spirit.app.desk'; isValid throws an
error for 'app.desk', 'spirit/app', '', 'spirit..app', 'spirit.app.', 5, null.
