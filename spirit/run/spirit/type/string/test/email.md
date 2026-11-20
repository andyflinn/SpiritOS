# spirit/type/string/email.js

The type spirit.type.string.email: an email address, its limit EMAIL_MAX_BYTES, 254 bytes (goal/G48.4). Its test: `./email.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for 'andy@example.com'; isValid throws an
error for 'nope', '', 'a@' + 'b'.repeat(254), 5, null.
