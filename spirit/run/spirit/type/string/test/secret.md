# spirit/type/string/secret.js

The type spirit.type.string.secret: a secret, a line of up to 1024 bytes with no spaces (Q4, Andy: "spirit/type/string/secret.js") (goal/G48.4). Its test: `./secret.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for 'sk-abc123', 'a'.repeat(1024); isValid throws an
error for 'has a space', 'a'.repeat(1025), 5, {}.
